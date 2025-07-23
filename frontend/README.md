# KenChat Frontend

This is the React TypeScript frontend for the KenChat personal chatbot application.

## Features

- **Authentication System**: Login and registration with JWT tokens
- **Responsive Design**: Material-UI components with responsive layout
- **State Management**: Redux Toolkit for application state
- **Routing**: React Router for navigation
- **HTTP Client**: Axios with authentication interceptors
- **Real-time Updates**: Ready for WebSocket integration
- **TypeScript**: Full type safety throughout the application

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # Layout components (Header, Sidebar, etc.)
│   └── UI/             # Common UI components
├── pages/              # Page components
├── services/           # API services and HTTP client
├── store/              # Redux store and slices
│   └── slices/         # Redux slices for different features
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## Available Scripts

- `npm start` - Start the development server
- `npm build` - Build the application for production
- `npm test` - Run the test suite
- `npm run eject` - Eject from Create React App (not recommended)

## Environment Variables

Create a `.env` file in the frontend directory with:

```
REACT_APP_API_URL=http://localhost:3001/api
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Key Components

### Authentication
- Login and registration forms with validation
- JWT token management with automatic refresh
- Protected routes and authentication guards

### Layout
- Responsive sidebar navigation
- Top navigation bar with user info
- Mobile-friendly design

### State Management
- Auth state for user authentication
- Conversation state for chat management
- Persona state for AI personality management
- UI state for application preferences

### API Integration
- Axios HTTP client with interceptors
- Automatic token attachment
- Error handling and retry logic
- Type-safe API interfaces

## Dependencies

### Core
- React 18 with TypeScript
- React Router DOM for routing
- Material-UI for components and theming

### State Management
- Redux Toolkit for state management
- React Redux for React integration

### HTTP & API
- Axios for HTTP requests
- Type-safe API interfaces

### Development
- TypeScript for type safety
- ESLint and Prettier for code quality

## Next Steps

This frontend foundation provides:
- ✅ Authentication UI and state management
- ✅ Responsive layout with navigation
- ✅ HTTP client with authentication
- ✅ Redux store setup
- ✅ Routing configuration
- ✅ Material-UI design system

Ready for implementation of:
- Chat interface components
- Conversation management
- Persona management
- Settings and preferences
- Real-time messaging
- File upload capabilities