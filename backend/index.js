// Import dependencies
import db from './db.js'; // Connect to database
import express from 'express'; // Routes and middleware
import session from 'express-session'; // User sessions
import cors from 'cors'; // Cross-origin resource sharing
import yahooFinance from 'yahoo-finance2'; // Yahoo finance stock fetching
import bcrypt from 'bcrypt'; // Password hashing
import dotenv from 'dotenv'; // Environment variables

const app = express(); // Create express app instance
app.use(express.json()); // express.json enables parsing of json files
dotenv.config(); // Load environment variables

// Define port
const PORT = 5000;

// Enable CORS
app.use(cors({
    origin: 'http://localhost:3000', // Frontend - Adjust for production
    credentials: true // Ensures cookies are sent
}))

// Configure sessions
app.use(session({
    secret: process.env.SESSION_SECRET, // Sign and encrypt session data
    resave: false, // Prevents unnecessary session saving
    saveUninitialized: false, // Do not save empty sessions (user visits but does not log in)
    cookie: { 
        secure: false, // Cookies sent over HTTPS only - Adjust for production
        httpOnly: true, // Prevents javascript from accessing cookies
        maxAge: 1000 * 60 * 60 // 1 hour session
    }
}));

// Title case helper
function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Logger function
const log = (level, module, message, data = null) => {
    const timeStamp = new Date().toISOString();
    console[level](`[${level.toUpperCase()}] [${timeStamp}] [${module}] - [${message}]`, data || '');
}

// Check auth function
const checkAuthHelper = ( req, res, next ) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, user: null, message: 'User not authenticated' });
    }

    next();
}

// Check authentication route
app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        log('info', 'check-auth', 'User is authenticated', { user: req.session.user.user_id });
        return res.status(200).json({ success: true, user: req.session.user.username, message: 'User is authenticated' });
    } else {
        log('info', 'check-auth', 'User not authenticated');
        return res.status(200).json({ success: false, user: null, message: 'User is not authenticated' }); // Still successful because users can be on homepage and not be authenticated
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { userNameOrEmail, password } = req.body; // Extracts username/email and password from request

    try {
        // Query database for user
        const result = await db.query('SELECT * FROM users WHERE username = $1 OR email = $1;', [userNameOrEmail]);
        
        // User not found
        if (result.rows.length === 0) {
            return res.status(401).json({success: false, message: 'Invalid username or email'}); // Return 401 (unauthorized)
        }

        // User found
        const user = result.rows[0];
        
        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({success: false, message: 'Incorrect password'}); // Return 401 (unauthorized)
        }

        // Successful login
        req.session.user = { user_id: user.user_id, username: user.username, email: user.email }; // Store user data for session
        log('info', 'login', 'User logged in', req.session.user.user_id); // Log information
        return res.status(200).json({success: true, user: req.session.user.username}); // Return successful login to frontend (200 is success)
    }
    catch (err) {
        log('error', 'login', 'Error when loggin in'); // Log error
        return res.status(500).json({success: false, message: 'Internal server error'}); // Return 500 (internal server error)
    }

});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => { // Log user out
        log('info', 'logout', 'User logged out'); // Log information
        return res.status(200).json({ success: true, message: 'User logged out' }); // Return logout success to frontend (200 is success)
    });
});

// Register route
app.post('/register', async (req, res) => {
    const { firstName, lastName, email, username, password, passwordConfirmation } = req.body; // Extract user details from request

    // Ensure all fields are provided
    if (!firstName || !lastName || !email || !username || !password || !passwordConfirmation) {
        return res.status(400).json({ success: false, message: 'All fields are required' }); // User error (400)
    }

    try {
        // Check length of fields
        if (firstName.length > 25 || lastName.length > 25 || username.length > 25 || password.length > 25) {
            return res.status(400).json({ success: false, message: 'First name, last name, username, and password must be less than 25 characters' }); // User error (400)
        }
        if (email.length > 50) {
            return res.status(400).json({ success: false, message: 'Email must be less than 50 characters' }); // User error (400)
        }

        // Check if password matches confirmation
        if (password !== passwordConfirmation) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' }); // User error (400)
        }

        // Check if username or email already exists
        const existsResult = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2;', [username, email]);
        if (existsResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or email already exists' }); // User error (400)
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        const registerQuery = 'INSERT INTO users (first_name, last_name, email, username, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *;';
        const registerResult = await db.query(registerQuery, [firstName, lastName, email, username, hashedPassword]);
        const userId = registerResult.rows[0].user_id;

        // Create default portfolio for user
        const portfolioQuery = 'INSERT INTO portfolios (user_id, portfolio_name) VALUES ($1, $2);';
        await db.query(portfolioQuery, [ userId , 'All' ]);

        // Successful registration
        log('info', 'register', 'User registered successfully', {firstName, lastName}); // Log successful registration
        const dataRes = {username: username, email: email}; // Do not return all data in databse - some is sensitive
        return res.status(201).json({ success: true, user: dataRes, message: 'Registered successfully' }); // Successful register (201 = created)
    }
    catch (err) {
        log('error', 'register', 'Internal server error'); // Log error
        return res.status(500).json({ success: false, message: 'Internal server error' }); // 500 status code to frontend (internal server error)
    }
});

// Get all portfolio names for a user
app.get('/portfolio/names', checkAuthHelper, async (req, res) => {

    try {
        const { rows: portfolioQuery } = await db.query('SELECT portfolio_name FROM portfolios WHERE user_id = $1;', [ req.session.user.user_id ]);
        
        // User has no default portfolio
        if (portfolioQuery.length === 0) {
            log('error', 'portfolio/names', 'User does not have any portfolios, including default', `user:  ${req.session.user.user_id}`);
            return res.status(404).json({ success: false, portfolioNames: []});
        }
        
        const portfolioNames = portfolioQuery.map(p => p.portfolio_name);
        log('info', 'portfolio/names', 'Porfolio names returned successfully', { user: req.session.user.user_id, portfolios: portfolioNames});
        return res.status(200).json({ success: true, portfolioNames: portfolioNames});
    }
    catch (err) {
        log('error', 'portfolio/names', 'Internal server error', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Portfolio route to fetch stocks in a portfolio (or all portfolios)
app.get('/portfolio/stocks', checkAuthHelper, async (req, res) => {
    
    const portfolioName = req.query.portfolioName;

    try {
        // Error checking before query database
        if (portfolioName.length > 50 || portfolioName === 'createNew') {
            return res.status(400).json({ success: false, message: 'Invalid input'});
        }

        // Get portfolio
        let portfolioQuery, portfolioParams;
        if (portfolioName === 'All') { // Default portfolio is container for all stocks not in portfolio, but want to show all stocks on frontend
            portfolioQuery = 'SELECT portfolio_id FROM portfolios WHERE user_id = $1;';
            portfolioParams = [ req.session.user.user_id ];
        }
        else {
            portfolioQuery = 'SELECT portfolio_id FROM portfolios WHERE user_id = $1 AND portfolio_name = $2;';
            portfolioParams = [ req.session.user.user_id, portfolioName ];
        }

        const { rows: portfolioIds } = await db.query(portfolioQuery, portfolioParams);
        
        // If portfolio not found
        if (portfolioIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Portfolio not found'});
        }

        // Get stock data given portfolio ids list
        const portfolioIdsList = portfolioIds.map(p => p.portfolio_id);
        const { rows: stocks } = await db.query('SELECT symbol, shares FROM portfolio_details WHERE portfolio_id = ANY($1);', [ portfolioIdsList ]);

        // If no stocks in portfolio
        if (stocks.length === 0) {
            log('info', 'portfolio/stocks', 'Empty portfolio', { stocks: [] });
            return res.status(200).json({ success: true, stocks: [] });
        }

        // Fetch stock values from yahoo finance API
        try {
            const stockSymbols = stocks.map(stock => stock.symbol);

            // API call to yahoo finance
            const stockPrices = await yahooFinance.quote(stockSymbols, {fields: ['shortName', 'regularMarketPrice' ] });

            // Combine data
            const stockData = stocks.map(stock => {
                const stockInfo = stockPrices.find(s => s.symbol === stock.symbol);
                
                return {
                    company: stockInfo.shortName,
                    symbol: stock.symbol,
                    shares: stock.shares,
                    share_price: stockInfo?.regularMarketPrice.toFixed(2) || 'Error',
                    total_price: ((stockInfo?.regularMarketPrice || 0) * stock.shares).toFixed(2),
                };
            });

            // Send result
            log('info', 'portfolio/stocks', 'Stocks fetched successfully', stockData);
            return res.status(200).json({ success: true, stocks: stockData });
        }
        catch (err) {
            // Error handling
            log('error', 'portfolio/stocks', 'Fetch Stocks failed', err.message);
            return res.status(500).json({ success: false, message: 'Internal server error'});
        }
    }
    catch (err) {
        log('error', 'portfolio/stocks', `Internal server error: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/portfolio/new', checkAuthHelper, async (req, res) => {
    const { portfolio } = req.body;

    // Ensure field is provided
    if (!portfolio) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const portfolioName = toTitleCase(portfolio); // Consistent format

    try {
        // Error check before entering into database
        if (portfolioName === 'All') { // Default portfolio
            return res.status(400).json({ success: false, message: 'All is an invalid portfolio name' });
        }
        if (portfolioName.length > 50) { // Length
            return res.status(400).json({ success: false, message: 'Portfolio name must be less than 50 characters' });
        }

        // Ensure another portfolio with same name doesn't exist
        const { rows: existsResult } = await db.query('SELECT portfolio_name FROM portfolios WHERE portfolio_name = $1 AND user_id = $2;', [ portfolioName, req.session.user.user_id ]);
        if (existsResult.length !== 0) {
            return res.status(400).json({ success: false, message: 'Portfolio name already exists '});
        }

        // Insert portfolio into database
        await db.query('INSERT INTO portfolios (portfolio_name, user_id) VALUES ($1, $2)', [ portfolioName, req.session.user.user_id ]);
        return res.status(200).json({ success: true, message: 'Portfolio created successfully' });
    }
    catch (err) {
        log('error', 'portfolio/new', 'Internal server error', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Transactions Route
app.get('/transactions', checkAuthHelper, async (req, res) => {

});

// Market Route
app.post('/market', checkAuthHelper, async (req, res) => {

});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});