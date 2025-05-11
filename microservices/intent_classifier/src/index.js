export const classifyIntentAndType = (mentions) => {
    if (!Array.isArray(mentions)) {
        console.error("Dummy classifyIntentAndType: Input was not an array.");
        return [];
    }
    return mentions.map(mention => {
        const text = mention.tweetText ? mention.tweetText.toLowerCase() : "";
        let intent = 'other';
        let handlingType = 'human'; 

        if (text.includes('how do i') || text.includes('what is') || text.includes('can you tell me')) {
            intent = 'question';
            if (text.includes('simple') || text.includes('reset password')) {
                handlingType = 'bot';
            } else {
                handlingType = 'human';
            }
        } else if (text.includes('broken') || text.includes("cancelled")|| text.includes('not working') || text.includes('i hate this') || text.includes('pissin')|| text.includes("I've been waiting")|| text.includes("refreshing") || text.includes('all I got') || text.includes('ban') || text.includes('fuck') || text.includes('Not a big fan') || text.includes("As much as I love")) {
            intent = 'complaint';
            if (text.includes('urgent') || text.includes('immediately') || text.includes("cancelled") || text.includes("As much as I love") || text.includes("I've been waiting") || text.includes("refreshing")) {
                handlingType = 'human';
            } else {
                handlingType = 'bot';
            }
        } else if (text.includes('great job') || text.includes('love it') || text.includes('good feature')) {
            intent = 'feedback';
            handlingType = 'acknowledge_log';
        }
        return { ...mention, intent, handlingType };
    });
};