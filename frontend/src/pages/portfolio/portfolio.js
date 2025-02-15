// Import styles
import './portfolio.scss';

const Portfolio = () => {
    return (
        <div id='portfolio-container'>
            <div id='info'>
                <div class='row'>
                    <div class='col col-6 col-md-4'>
                        <h5>Cash on Hand: // DB Req \\</h5>
                    </div>
                    <div class='col col-6 col-md-4'>
                        <h5>Portfolio Value: // DB Req \\</h5>
                    </div>
                    <div class='col col-6 col-md-4'>
                        <h5>Lifetime +/-: // DB Req \\</h5>
                    </div>
                    <div class='col col-6 col-md-4'>
                        <select class='form-select' aria-label='Portfolio Select'>
                            <option selected>Select Portfolio</option>
                        </select>
                    </div>
                    <div class='col col-6 col-md-4'>
                        <h5>Investment +/-: // DB Req \\</h5>
                    </div>
                    <div class='col col-6 col-md-4'>
                        <h5>Lifetime ROI: // DB Req \\</h5> 
                    </div>
                </div>
            </div>

            <div id='details'>
                <div id='table-container'>
                    <table class='table table-striped scrollable'>
                        <thead>
                            <tr>
                                <th>Stock</th>
                                <th>Symbol</th>
                                <th>Shares</th>
                                <th>Total Value</th>
                                <th>+/-</th>
                                <th>Transaction History</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>TEST</td>
                                <td>TEST</td>
                                <td>100</td>
                                <td>$10000</td>
                                <td>$23242234</td>
                                <td><button class='btn'>View</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>



            </div>



        </div>
    )
}

export default Portfolio;