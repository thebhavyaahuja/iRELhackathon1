export const classifyIntentAndType = (mentions) => {
    if (!Array.isArray(mentions)) {
        console.error("Dummy classifyIntentAndType: Input was not an array.");
        return [];
    }
    return mentions.map(mention => {
        const text = mention.tweetText ? mention.tweetText.toLowerCase() : "";
        let intent = 'other';
        let handlingType = 'manual_review'; // Default for 'other'

        if (text.includes('how do i') || text.includes('what is') || text.includes('can you tell me')) {
            intent = 'question';
            if (text.includes('simple') || text.includes('reset password')) {
                handlingType = 'type1_bot';
            } else {
                handlingType = 'type2_human';
            }
        } else if (text.includes('broken') || text.includes('not working') || text.includes('i hate this')) {
            intent = 'complaint';
            if (text.includes('urgent') || text.includes('immediately')) {
                handlingType = 'type2_human';
            } else {
                handlingType = 'type1_bot';
            }
        } else if (text.includes('great job') || text.includes('love it') || text.includes('good feature')) {
            intent = 'feedback';
            handlingType = 'acknowledge_log';
        }
        return { ...mention, intent, handlingType };
    });
};