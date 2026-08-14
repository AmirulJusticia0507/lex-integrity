import React, { createContext, useContext, useReducer, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const AnalyticsContext = createContext();

const initialState = {
  stats: {},
  loading: false,
  error: null,
  exportData: null
};

function analyticsReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_STATS':
      return { ...state, stats: action.payload, loading: false };
    case 'SET_EXPORT_DATA':
      return { ...state, exportData: action.payload, loading: false };
    default:
      return state;
  }
}

function AnalyticsProvider({ children }) {
  const [state, dispatch] = useReducer(analyticsReducer, initialState);
  
  const fetchAnalytics = useCallback(async (timeRange = '30d') => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await axios.get(`${API_BASE_URL}/api/analytics?range=${timeRange}`);
      dispatch({ type: 'SET_STATS', payload: response.data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);
  
  const exportAnalytics = useCallback(async (format = 'json', filters = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });
      
      const response = await axios.get(`${API_BASE_URL}/api/analytics/export?${queryParams.toString()}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        dispatch({ type: 'SET_EXPORT_DATA', payload: response.data });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const value = {
    ...state,
    fetchAnalytics,
    exportAnalytics,
    clearError: () => dispatch({ type: 'SET_ERROR', payload: null })
  };
  
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

function useAnalyticsStore() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsStore must be used within an AnalyticsProvider');
  }
  return context;
}

export { AnalyticsProvider, useAnalyticsStore };