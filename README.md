# Node Provider Rewards App

A simple JavaScript application that fetches and displays the most recent monthly node provider rewards from the Internet Computer governance canister.

## Overview

This application demonstrates how to call an Internet Computer canister using the JavaScript Agent library. It specifically queries the governance canister (`rrkah-fqaaa-aaaaa-aaaaq-cai`) to get the most recent monthly node provider rewards data.

## Features

- Fetches data from the governance canister via the `get_most_recent_monthly_node_provider_rewards` method
- Displays a summary of the rewards data
- Shows detailed information about each node provider reward
- Handles loading states and errors

## Technologies Used

- JavaScript (ES6+)
- Internet Computer JavaScript Agent Library (@dfinity/agent)
- Webpack for bundling
- HTML/CSS for the user interface

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd node_provider_rewards_app
```

2. Install dependencies:

```bash
npm install
```

## Running the Application

To start the development server:

```bash
npm start
```

This will open the application in your default web browser at `http://localhost:8080`.

## Building for Production

To build the application for production:

```bash
npm run build
```

This will create a `dist` directory with the bundled application.

## How it Works

The application uses the Internet Computer JavaScript Agent library to create an actor that can call the governance canister. When the "Fetch Latest Rewards" button is clicked, it makes a query call to the `get_most_recent_monthly_node_provider_rewards` method and displays the results.

## License

This project is open source and available under the MIT License. 
