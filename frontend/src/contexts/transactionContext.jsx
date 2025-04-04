import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { transactionsHelper, useNavigation } from "../utils/helpers";
import { usePortfolio } from "./portfolioContext";
import { useAuth } from "./authContext";

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
    // Helpers
    const navigate = useNavigation();

    // Contexts
    const { user } = useAuth();
    const { portfolioFilter, stockFilter, setStockFilter } = usePortfolio();

    // States
    const [transactions, setTransactions] = useState([]);
    const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(new Date(new Date(endDate).setDate(new Date(endDate).getDate() - 7)).toISOString().split('T')[0]);

    // Update transactions
    const updateTransactions = useCallback(async () => {
        const data = await transactionsHelper(portfolioFilter, stockFilter, transactionTypeFilter, startDate, endDate);
        if (data.success) {
            setTransactions(data.transactions);
        }
    }, [portfolioFilter, stockFilter, transactionTypeFilter, startDate, endDate]);
    // Get transactions on context render and filter changes
    useEffect(() => {
        const refresh = async () => {
            user ? await updateTransactions() : setTransactions([]);
        }
        refresh();
    }, [portfolioFilter, stockFilter, transactionTypeFilter, startDate, endDate, user, updateTransactions ]);

    // Handle transaction redirect
    const handleTransactionRedirect = ( stock ) => {
        setStockFilter(stock);
        navigate('/transactions')();
    }

    return (
        <TransactionContext.Provider value={{ transactions, updateTransactions, transactionTypeFilter, setTransactionTypeFilter, startDate, setStartDate, endDate, setEndDate , handleTransactionRedirect }}>
            { children }
        </TransactionContext.Provider>
    )
}

export const useTransaction = () => {
    return useContext(TransactionContext);
}