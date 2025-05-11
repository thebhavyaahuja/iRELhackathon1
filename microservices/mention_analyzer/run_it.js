import { extractAndAnalyzeMentions } from './src/mention_analyzer.js';

async function main() {
  const searchQuery = process.argv[2]; // Get the search query from command line arguments

  if (!searchQuery) {
    console.error('Please provide a search query as a command line argument.');
    console.log('Usage: node run_it.js <searchQuery>');
    process.exit(1);
  }

  // Removed the environment variable check for X_BEARER_TOKEN

  try {
    console.log(`Analyzing mentions for: "${searchQuery}"...`);
    const mentions = await extractAndAnalyzeMentions(searchQuery);
    console.log('Mentions found:');
    console.log(JSON.stringify(mentions, null, 2));
  } catch (error) {
    console.error('Error during mention analysis:', error);
  }
}

main();
