# Slar CRM

A full-stack solar company CRM built with a modern web stack.

## Monorepo Structure

- `/backend`: Node.js + Express + TypeScript API server
- `/frontend`: React + TypeScript + Vite web application
- `/shared`: Shared TypeScript types, enums, and Zod schemas
- `/docs`: API Documentation

## Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis

## Setup

1. Copy `.env.example` to `.env` in the root (some envs apply globally) and to individual workspaces as needed.
2. Install dependencies from the root:
   ```bash
   npm install
   ```

## Available Scripts

- `npm run dev:backend` - Starts the backend development server
- `npm run dev:frontend` - Starts the frontend development server
- `npm run dev:all` - Starts both backend and frontend concurrently
- `npm run build:all` - Builds all workspaces
- `npm run test:all` - Runs tests in all workspaces
