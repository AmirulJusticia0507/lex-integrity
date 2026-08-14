import React, { createContext, useContext, useReducer, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const RuleContext = createContext();

const initialState = {
  rules: [],
  searchResults: [],
  stats: {},
  regimes: [],
  categories: [],
  loading: false,
  error: null,
  pagination: {}
};

function ruleReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_RULES':
      return { ...state, rules: action.payload, loading: false };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload, loading: false };
    case 'SET_STATS':
      return { ...state, stats: action.payload, loading: false };
    case 'SET_REGIMES':
      return { ...state, regimes: action.payload, loading: false };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload, loading: false };
    case 'SET_PAGINATION':
      return { ...state, pagination: action.payload };
    case 'ADD_RULE':
      return { ...state, rules: [action.payload, ...state.rules] };
    case 'UPDATE_RULE':
      return {
        ...state,
        rules: state.rules.map(rule => 
          rule.rule_code === action.payload.rule_code ? action.payload : rule
        ),
        searchResults: state.searchResults.map(rule =>
          rule.rule_code === action.payload.rule_code ? action.payload : rule
        )
      };
    case 'DELETE_RULE':
      return {
        ...state,
        rules: state.rules.filter(rule => rule.rule_code !== action.payload),
        searchResults: state.searchResults.filter(rule => rule.rule_code !== action.payload)
      };
    default:
      return state;
  }
}

function RuleProvider({ children }) {
  const [state, dispatch] = useReducer(ruleReducer, initialState);
  
  const fetchRules = useCallback(async (params = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });
      
      const response = await axios.get(`${API_BASE_URL}/api/rules?${queryParams.toString()}`);
      dispatch({ type: 'SET_RULES', payload: response.data.data });
      dispatch({ type: 'SET_PAGINATION', payload: response.data.pagination });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);
  
  const fetchRuleByCode = useCallback(async (ruleCode) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rules/${ruleCode}`);
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);
  
  const createRule = useCallback(async (ruleData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await axios.post(`${API_BASE_URL}/api/rules`, ruleData);
      dispatch({ type: 'ADD_RULE', payload: response.data.data });
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const updateRule = useCallback(async (ruleCode, updates) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await axios.put(`${API_BASE_URL}/api/rules/${ruleCode}`, updates);
      dispatch({ type: 'UPDATE_RULE', payload: response.data.data });
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const deleteRule = useCallback(async (ruleCode) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await axios.delete(`${API_BASE_URL}/api/rules/${ruleCode}`);
      dispatch({ type: 'DELETE_RULE', payload: ruleCode });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const searchRules = useCallback(async (query) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rules/search/suggestions?q=${query}`);
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: response.data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);
  
  const fetchRegimes = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/regimes`);
      dispatch({ type: 'SET_REGIMES', payload: response.data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);
  
  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/categories`);
      dispatch({ type: 'SET_CATEGORIES', payload: response.data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);
  
  const fetchDashboardData = useCallback(async (regime = 'all', timeRange = 'all') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rules/analytics/overview`);
      dispatch({ type: 'SET_STATS', payload: response.data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);
  
  const analyzeConflicts = useCallback(async (regime) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rules/${regime}/conflicts`);
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);
  
  const fetchRuleConflicts = useCallback(async (ruleCode) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rules/${ruleCode}/conflicts`);
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);
  
  const analyzeRule = useCallback(async (ruleCode) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/rules/${ruleCode}/analyze`);
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);
  
  const value = {
    ...state,
    fetchRules,
    fetchRuleByCode,
    createRule,
    updateRule,
    deleteRule,
    searchRules,
    fetchRegimes,
    fetchCategories,
    fetchDashboardData,
    analyzeConflicts,
    fetchRuleConflicts,
    analyzeRule,
    clearError: () => dispatch({ type: 'SET_ERROR', payload: null })
  };
  
  return <RuleContext.Provider value={value}>{children}</RuleContext.Provider>;
}

function useRuleStore() {
  const context = useContext(RuleContext);
  if (!context) {
    throw new Error('useRuleStore must be used within a RuleProvider');
  }
  return context;
}

export { RuleProvider, useRuleStore };