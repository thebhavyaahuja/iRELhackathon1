
const { extractAndAnalyzeMentions } = require("./microservices/mention_analyzer/src/mention_analyzer.js")

async function searchForNikeMentions() {
    try {
        const text = "nike";
        
        const result = await extractAndAnalyzeMentions(text);
        
        console.log(result);
    } catch (error) {
        console.error("Error analyzing Nike mentions:", error);
    }
}

// Call the function
searchForNikeMentions();