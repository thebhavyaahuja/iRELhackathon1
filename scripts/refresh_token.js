const fs = require('fs');
const path = require('path');

// IMPORTANT: YOU MUST IMPLEMENT THIS FUNCTION
// This function should use your credentials (passed as arguments or read from env)
// to interact with the authentication mechanism of X/Twitter and return a new Bearer Token.
// This is highly specific to how tokens are generated and is the most complex part.
async function fetchNewTwitterToken(apiUsername, apiPassword) {
    console.log("Attempting to fetch a new Twitter token...");
    // Replace this with your actual token fetching logic.
    // This might involve making HTTP requests to login endpoints, handling cookies,
    // parsing responses, etc.
    // Example (conceptual, will NOT work for X/Twitter directly):
    // const response = await fetch('https://auth.example.com/token', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username: apiUsername, password: apiPassword, grant_type: 'password' })
    // });
    // if (!response.ok) {
    //   throw new Error(`Failed to fetch token: ${response.statusText}`);
    // }
    // const data = await response.json();
    // return data.access_token;

    // Placeholder: returns a dummy token. Replace this.
    const dummyToken = `dummy_token_${Date.now()}`;
    console.log(`Fetched dummy token: ${dummyToken}`);
    return dummyToken;
    // throw new Error("fetchNewTwitterToken logic is not implemented yet.");
}

async function updateShellConfigWithNewToken() {
    const apiUsername = process.env.X_API_USERNAME;
    const apiPassword = process.env.X_API_PASSWORD;

    if (!apiUsername || !apiPassword) {
        console.error("Error: X_API_USERNAME and X_API_PASSWORD environment variables must be set for the script to run.");
        process.exit(1);
    }

    try {
        const newToken = await fetchNewTwitterToken(apiUsername, apiPassword);
        if (!newToken) {
            console.error("Error: Failed to obtain a new token (fetchNewTwitterToken returned null or empty).");
            process.exit(1);
        }

        const shellConfigPath = path.join(process.env.HOME, '.bashrc'); // Assuming bash shell as per your setup

        if (!fs.existsSync(shellConfigPath)) {
            console.warn(`Warning: Shell configuration file not found at ${shellConfigPath}. Attempting to create it.`);
            // You might want to handle this differently, e.g., by erroring out or choosing a different file.
        }
        
        let configContent = "";
        if (fs.existsSync(shellConfigPath)) {
            configContent = fs.readFileSync(shellConfigPath, 'utf-8');
        }

        const lines = configContent.split('\n');
        let found = false;
        const newLines = lines.map(line => {
            // Match 'export X_BEARER_TOKEN=' or 'X_BEARER_TOKEN='
            if (line.trim().startsWith('export X_BEARER_TOKEN=') || (line.trim().startsWith('X_BEARER_TOKEN=') && !line.trim().startsWith('export'))) {
                found = true;
                // Preserve 'export' if it was there, and ensure no duplicate 'export'
                if (line.trim().startsWith('export')) {
                    return `export X_BEARER_TOKEN=${newToken}`;
                }
                return `X_BEARER_TOKEN=${newToken}`; // If no export, just set it. Consider adding export.
            }
            return line;
        });

        if (!found) {
            // Add with 'export' to make it available to child processes
            newLines.push(`export X_BEARER_TOKEN=${newToken}`);
        }
        
        // Filter out potential empty strings at the end if the original file ended with multiple newlines
        const finalConfigContent = newLines.filter(line => line || line === '').join('\n');

        fs.writeFileSync(shellConfigPath, finalConfigContent);
        console.log(`Successfully updated ${shellConfigPath} with the new X_BEARER_TOKEN.`);
        console.log("\nIMPORTANT: For the new token to take effect in your current session, run:");
        console.log(`    source ${shellConfigPath}`);
        console.log("Or, open a new terminal session.");

    } catch (error) {
        console.error("Error during token refresh process:", error);
        process.exit(1);
    }
}

updateShellConfigWithNewToken();
