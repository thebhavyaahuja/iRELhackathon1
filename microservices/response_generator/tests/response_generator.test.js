// filepath: /code/Research/iREL/hackathon1/iRELhackathon1/microservices/response_generator/tests/response_generator.test.js

// Define mocks before they are used in jest.mock factories
const mockGenerateContent = jest.fn();
const mockPoolQuery = jest.fn();

// Mock the GoogleGenerativeAI and pg modules
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
        }),
    })),
}));

jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        query: mockPoolQuery,
    })),
}));

// IMPORTANT: Require the module under test AFTER jest.mock calls
const { processMention } = require('../src/response_generator');

// Mock console methods to prevent output during tests and allow assertions
let originalConsole;

beforeAll(() => {
    originalConsole = { ...console }; // Save original console methods
    global.console = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(), // Add other methods if used
        debug: jest.fn(),
    };
});

afterAll(() => {
    global.console = originalConsole; // Restore original console methods
});

describe('Response Generator Microservice', () => {
    beforeEach(() => {
        // Clear mock history before each test
        mockGenerateContent.mockClear();
        mockPoolQuery.mockClear();
        // Clear all console mocks
        for (const method in global.console) {
            if (typeof global.console[method] === 'function' && global.console[method].mockClear) {
                global.console[method].mockClear();
            }
        }
    });

    describe('generateBotResponse (via processMention)', () => {
        it('should call Gemini API with correct prompt for a question', async () => {
            const mentionData = {
                text: "What is the weather like?",
                tweetId: "tweet123",
                userId: "userABC",
                url: "https://x.com/userABC/status/tweet123",
                intent: "question",
                response_type: "bot"
            };
            mockGenerateContent.mockResolvedValue({ response: { text: () => 'It is sunny!' } });

            await processMention(mentionData);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.stringContaining('As a brand representative, provide a helpful and concise answer to the following customer question.')
            );
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining(mentionData.text));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Generated bot response: "It is sunny!"'));
        });

        it('should call Gemini API with correct prompt for a complaint', async () => {
            const mentionData = {
                text: "This product is terrible!",
                tweetId: "tweet456",
                userId: "userDEF",
                url: "https://x.com/userDEF/status/tweet456",
                intent: "complaint",
                response_type: "bot"
            };
            mockGenerateContent.mockResolvedValue({ response: { text: () => 'We are sorry to hear that.' } });

            await processMention(mentionData);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.stringContaining('As a brand representative, provide an empathetic and helpful initial response to the following customer complaint.')
            );
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining(mentionData.text));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Generated bot response: "We are sorry to hear that."'));
        });

        it('should return a fallback response if Gemini API fails', async () => {
            const mentionData = {
                text: "Another question?",
                tweetId: "tweet789",
                userId: "userGHI",
                url: "https://x.com/userGHI/status/tweet789",
                intent: "question",
                response_type: "bot"
            };
            mockGenerateContent.mockRejectedValue(new Error('Gemini API Error'));

            await processMention(mentionData);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith('Error calling Gemini API:', expect.any(Error));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('We\'ve received your message and will get back to you as soon as possible.'));
        });
    });

    describe('openTicketForHumanIntervention (via processMention)', () => {
        it('should call database to insert a ticket for a human-escalated complaint', async () => {
            const mentionData = {
                text: "I need to speak to a manager!",
                tweetId: "ticket001",
                userId: "userJKL",
                url: "https://x.com/userJKL/status/ticket001",
                intent: "complaint",
                response_type: "human"
            };
            mockPoolQuery.mockResolvedValue({ rows: [{ id: 'ticketXYZ' }] });

            await processMention(mentionData);

            expect(mockPoolQuery).toHaveBeenCalledTimes(1);
            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO tickets'),
                [mentionData.tweetId, mentionData.userId, mentionData.text, mentionData.url, mentionData.intent, 'open']
            );
            expect(console.log).toHaveBeenCalledWith('Ticket opened with ID: ticketXYZ for tweet: https://x.com/userJKL/status/ticket001');
        });

        it('should handle database error when opening a ticket', async () => {
            const mentionData = {
                text: "My issue is very complex.",
                tweetId: "ticket002",
                userId: "userMNO",
                url: "https://x.com/userMNO/status/ticket002",
                intent: "question",
                response_type: "human"
            };
            const dbError = new Error('DB Error');
            mockPoolQuery.mockRejectedValue(dbError);
            
            try {
                 await processMention(mentionData);
            } catch (e) {
                expect(e).toBe(dbError); // Check if the error is re-thrown
            }
            expect(mockPoolQuery).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith('Error opening ticket in database:', dbError);
        });
    });

    describe('processMention routing', () => {
        it('should log feedback intent correctly', async () => {
            const mentionData = {
                text: "Great product!",
                tweetId: "feedback001",
                userId: "userHappy",
                url: "https://x.com/userHappy/status/feedback001",
                intent: "feedback",
                response_type: "bot"
            };

            await processMention(mentionData);
            expect(console.log).toHaveBeenCalledWith('Intent is \'feedback\'. Logging feedback from tweet: https://x.com/userHappy/status/feedback001');
            expect(mockGenerateContent).not.toHaveBeenCalled();
            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should log \'other\' intent correctly', async () => {
            const mentionData = {
                text: "Just a random thought.",
                tweetId: "other001",
                userId: "userRandom",
                url: "https://x.com/userRandom/status/other001",
                intent: "other",
                response_type: "bot"
            };

            await processMention(mentionData);
            expect(console.log).toHaveBeenCalledWith('Intent is \'other\'. No specific action defined for tweet: https://x.com/userRandom/status/other001');
            expect(mockGenerateContent).not.toHaveBeenCalled();
            expect(mockPoolQuery).not.toHaveBeenCalled();
        });

        it('should warn for unknown intent or response type', async () => {
            const mentionData = {
                text: "Unknown scenario.",
                tweetId: "unknown001",
                userId: "userUnknown",
                url: "https://x.com/userUnknown/status/unknown001",
                intent: "weird_intent", // Invalid intent
                response_type: "bot"
            };

            await processMention(mentionData);
            expect(console.warn).toHaveBeenCalledWith('Unknown intent or response type:', mentionData);
            expect(mockGenerateContent).not.toHaveBeenCalled();
            expect(mockPoolQuery).not.toHaveBeenCalled();
        });
    });
});
