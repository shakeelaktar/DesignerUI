// Jest setup: extend matchers and provide window.alert mock for jsdom
import '@testing-library/jest-dom';
Object.defineProperty(window, 'alert', { value: (msg: any) => { /* no-op */ } });
