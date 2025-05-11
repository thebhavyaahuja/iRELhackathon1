import { describe, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { extractAndAnalyzeMentions } from '../src/scraper';

// Mock the global fetch function
// global.fetch = jest.fn();

const mockTweetEntry = (tweetId, userId, screenName, name, text, date, favs, rts, lang) => ({
    entryId: `tweet-${tweetId}`,
    sortIndex: "1921291770616872950",
    content: {
        entryType: "TimelineTimelineItem",
        __typename: "TimelineTimelineItem",
        itemContent: {
            itemType: "TimelineTweet",
            __typename: "TimelineTweet",
            tweet_results: {
                result: {
                    __typename: "Tweet",
                    rest_id: tweetId,
                    core: {
                        user_results: {
                            result: {
                                __typename: "User",
                                id: `VXNlcjo${userId}`,
                                rest_id: userId,
                                affiliates_highlighted_label: {},
                                has_graduated_access: true,
                                is_blue_verified: false,
                                legacy: {
                                    screen_name: screenName,
                                    name: name,
                                    // ... other user legacy fields
                                },
                                // ... other user fields
                            }
                        }
                    },
                    legacy: {
                        full_text: text,
                        created_at: date,
                        favorite_count: favs,
                        retweet_count: rts,
                        lang: lang,
                        // ... other tweet legacy fields
                    }
                    // ... other tweet result fields
                }
            },
            tweetDisplayType: "Tweet"
        }
    }
});

const mockUserEntry = (userId, screenName, name, description, location, followers, friends, profileImageUrl) => ({
    entryId: `toptabsrpusermodule-someid-user-${userId}`,
    sortIndex: "1921291770616872961", // different from tweet sortIndex
    content: {
        entryType: "TimelineTimelineModule",
        __typename: "TimelineTimelineModule",
        items: [
            {
                entryId: `toptabsrpusermodule-someid-user-${userId}-item`,
                item: {
                    itemContent: {
                        itemType: "TimelineUser",
                        __typename: "TimelineUser",
                        user_results: {
                            result: {
                                __typename: "User",
                                id: `VXNlcjo${userId}`,
                                rest_id: userId,
                                legacy: {
                                    screen_name: screenName,
                                    name: name,
                                    description: description,
                                    location: location,
                                    followers_count: followers,
                                    friends_count: friends,
                                    profile_image_url_https: profileImageUrl,
                                    // ... other user legacy fields
                                },
                                // ... other user fields
                            }
                        },
                        userDisplayType: "UserDetailed"
                    }
                }
            }
        ],
        displayType: "Vertical",
        header: { text: "People" }
    }
});

describe('extractAndAnalyzeMentions', () => {
    const originalEnv = process.env;
    let fetchSpy;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.X_BEARER_TOKEN = 'test_token';
        fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(jest.fn());
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('should extract user and tweet mentions from a successful API response for "Jest testing"', async () => {
        const mockApiResponse = {
            data: {
                search_by_raw_query: {
                    search_timeline: {
                        timeline: {
                            instructions: [
                                {
                                    type: "TimelineAddEntries",
                                    entries: [
                                        mockUserEntry("user123", "jestUser", "Jest User", "Loves testing", "Testland", 100, 50, "http://example.com/jest.jpg"),
                                        mockTweetEntry("tweet456", "user789", "testerDev", "Tester Developer", "This is a test tweet about Jest #testing", "Mon May 12 10:00:00 +0000 2025", 10, 5, "en"),
                                    ]
                                }
                            ],
                            responseObjects: {}
                        }
                    }
                }
            }
        };

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const mentions = await extractAndAnalyzeMentions('Jest testing');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const fetchUrl = fetchSpy.mock.calls[0][0];
        expect(fetchUrl).toContain('rawQuery%22%3A%22Jest%20testing%22');
        expect(fetchSpy.mock.calls[0][1].method).toBe('GET');

        expect(mentions).toHaveLength(2);

        // Check user mention
        expect(mentions).toContainEqual({
            id: "user123",
            screenName: "jestUser",
            name: "Jest User",
            description: "Loves testing",
            location: "Testland",
            followersCount: 100,
            friendsCount: 50,
            profileImageUrl: "http://example.com/jest.jpg",
            type: 'user_profile'
        });

        // Check tweet mention
        expect(mentions).toContainEqual({
            tweetId: "tweet456",
            userId: "user789",
            screenName: "testerDev",
            name: "Tester Developer",
            tweetText: "This is a test tweet about Jest #testing",
            createdAt: "Mon May 12 10:00:00 +0000 2025",
            favoriteCount: 10,
            retweetCount: 5,
            lang: "en",
            tweetUrl: "https://x.com/testerDev/status/tweet456",
            type: 'tweet'
        });
    });

    it('should handle API response with no relevant entries', async () => {
        const mockApiResponse = {
            data: {
                search_by_raw_query: {
                    search_timeline: {
                        timeline: {
                            instructions: [
                                {
                                    type: "TimelineAddEntries",
                                    entries: [] // No entries
                                }
                            ],
                            responseObjects: {}
                        }
                    }
                }
            }
        };

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const mentions = await extractAndAnalyzeMentions('empty query');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(mentions).toHaveLength(0);
    });

    it('should throw an error if the network response is not ok', async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: false,
            statusText: 'Forbidden',
            text: async () => 'API limit exceeded'
        });

        await expect(extractAndAnalyzeMentions('error query')).rejects.toThrow('Network response was not ok Forbidden. Body: API limit exceeded');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle missing data structures in API response gracefully', async () => {
        const mockApiResponse = { data: {} }; // Incomplete data

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const mentions = await extractAndAnalyzeMentions('malformed data');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(mentions).toEqual([]); // Should return empty array or handle as per design
    });

    it('should correctly encode the search query in the API URL', async () => {
        const mockApiResponse = { data: { search_by_raw_query: { search_timeline: { timeline: { instructions: [] } } } } }; // Minimal valid structure
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const searchQuery = 'complex query with spaces & special chars like !@#$%^&*()';
        await extractAndAnalyzeMentions(searchQuery);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const fetchUrl = fetchSpy.mock.calls[0][0];
        const expectedEncodedQuery = encodeURIComponent(searchQuery);
        expect(fetchUrl).toContain(`rawQuery%22%3A%22${expectedEncodedQuery}%22`);
        expect(fetchSpy.mock.calls[0][1].headers.Referer).toBe(`https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query`);
    });

    it('should extract only user mentions if only user entries are present', async () => {
        const mockApiResponse = {
            data: {
                search_by_raw_query: {
                    search_timeline: {
                        timeline: {
                            instructions: [
                                {
                                    type: "TimelineAddEntries",
                                    entries: [
                                        mockUserEntry("userOnly1", "UserOnlyScreen", "User Only Name", "Desc", "Loc", 10, 5, "url"),
                                    ]
                                }
                            ],
                            responseObjects: {}
                        }
                    }
                }
            }
        };

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const mentions = await extractAndAnalyzeMentions('users only');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(mentions).toHaveLength(1);
        expect(mentions[0].type).toBe('user_profile');
        expect(mentions[0].screenName).toBe('UserOnlyScreen');
    });

    it('should extract only tweet mentions if only tweet entries are present', async () => {
        const mockApiResponse = {
            data: {
                search_by_raw_query: {
                    search_timeline: {
                        timeline: {
                            instructions: [
                                {
                                    type: "TimelineAddEntries",
                                    entries: [
                                        mockTweetEntry("tweetOnly1", "userTweet", "TweetUserScreen", "Tweet User Name", "Just a tweet", "Tue May 13 00:00:00 +0000 2025", 1,0,"en"),
                                    ]
                                }
                            ],
                            responseObjects: {}
                        }
                    }
                }
            }
        };

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse,
            statusText: 'OK'
        });

        const mentions = await extractAndAnalyzeMentions('tweets only');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(mentions).toHaveLength(1);
        expect(mentions[0].type).toBe('tweet');
        expect(mentions[0].tweetId).toBe('tweetOnly1');
    });

});
