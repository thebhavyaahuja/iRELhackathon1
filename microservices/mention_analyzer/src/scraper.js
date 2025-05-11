async function extractAndAnalyzeMentions(searchQuery) {
    const variables = {
        rawQuery: searchQuery,
        count: 20,
        querySource: "typed_query",
        product: "Top",
    };
    const features = {
        rweb_video_screen_enabled: false,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: true,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: false,
        responsive_web_grok_share_attachment_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
    };

    const apiUrl = `https://x.com/i/api/graphql/yiE17ccAAu3qwM34bPYZkQ/SearchTimeline?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

    const bearerToken = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"; // Using the hardcoded token

    const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "authorization": `Bearer ${bearerToken}`, // Use the token from environment variable
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Not.A/Brand\";v=\"99\", \"Chromium\";v=\"136\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-client-transaction-id": "HHvrb7Urd02nDvbLodvwwAgdzdACAqEMi6dq6yKOyqkWkTw1UvabckVes4ydzH94Q5NVzB8YqNB5WDR9UZlj2b3jfz6qHw", // Added from search_req.local.js
            "x-csrf-token": "89a451794283aec91942d9843effbe3b0aad5cc40d94a5235a69be19f1b7c58ca8c1eb630772ca086ea8d9f729bf93dd4fa82163670c0fc53025b9270bebcc6d99bbcf548e4ffff6d02c5307096f310d", // Added from search_req.local.js
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en",
            "cookie": "guest_id=v1%3A171111727480469151; night_mode=2; guest_id_marketing=v1%3A171111727480469151; guest_id_ads=v1%3A171111727480469151; g_state={\"i_l\":0}; kdt=sCNrpgn8xoVp1N2Af0c5Yghr612S9QkZ0P1v61R7; lang=en; personalization_id=\"v1_Fj7mqz3rWrvj6Uoi7HDW8g==\"; auth_token=c454b43ea4e0f9c0f6edfe0989c069b4c2f0c6e2; ct0=89a451794283aec91942d9843effbe3b0aad5cc40d94a5235a69be19f1b7c58ca8c1eb630772ca086ea8d9f729bf93dd4fa82163670c0fc53025b9270bebcc6d99bbcf548e4ffff6d02c5307096f310d; twid=u%3D1679775308751175680; att=1-MxTKaSRtlGpasNKGEI2t9yxhFDRKY8a5r1VgcnmX; ph_phc_TXdpocbGVeZVm5VJmAsHTMrCofBQu3e0kN8HGMNGTVW_posthog=%7B%22distinct_id%22%3A%220196bb81-3afd-72d3-9ac0-42adfa0e0649%22%2C%22%24sesid%22%3A%5B1746902530849%2C%220196bb81-3afc-70c7-b9b6-3632297bec3c%22%2C1746902530812%5D%7D; __cf_bm=5xiLOWtRfj3P5h2FAYZu3_ZRA4wxfdArwAwIGIwEq2c-1746906345-1.0.1.1-5aZRys4jhmV_i0.lG4.pqqTHkw.0a9jZg4brk51HFwBQD7klbSwnhX309FGqKsKoICDeAXPh3kDCcIYlqujtlPc2soazznFaf48qdGtSHPbOja6lZjqQn_Qh14wP4i5h", // Added from search_req.local.js
            "Referer": `https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query`,
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        body: null
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Network response was not ok ${response.statusText}. Body: ${errorText}`);
    }

    const data = await response.json();
    const mentions = [];

    if (data.data && data.data.search_by_raw_query && data.data.search_by_raw_query.search_timeline && data.data.search_by_raw_query.search_timeline.timeline && data.data.search_by_raw_query.search_timeline.timeline.instructions) {
        const instructions = data.data.search_by_raw_query.search_timeline.timeline.instructions;
        instructions.forEach(instruction => {
            if (instruction.type === "TimelineAddEntries" && instruction.entries) {
                instruction.entries.forEach(entry => {
                    if (entry.content.entryType === "TimelineTimelineModule" && entry.content.items) {
                        entry.content.items.forEach(item => {
                            if (item.item && item.item.itemContent && item.item.itemContent.itemType === "TimelineUser") {
                                const userResult = item.item.itemContent.user_results.result;
                                if (userResult && userResult.legacy) {
                                    mentions.push({
                                        id: userResult.rest_id,
                                        screenName: userResult.legacy.screen_name,
                                        name: userResult.legacy.name,
                                        description: userResult.legacy.description,
                                        location: userResult.legacy.location,
                                        followersCount: userResult.legacy.followers_count,
                                        friendsCount: userResult.legacy.friends_count,
                                        profileImageUrl: userResult.legacy.profile_image_url_https,
                                        type: 'user_profile'
                                    });
                                }
                            }
                        });
                    }
                    if (entry.content.entryType === "TimelineTimelineItem" && entry.content.itemContent && entry.content.itemContent.itemType === "TimelineTweet") {
                        const tweetResult = entry.content.itemContent.tweet_results.result;
                        if (tweetResult && tweetResult.core && tweetResult.core.user_results && tweetResult.core.user_results.result && tweetResult.core.user_results.result.legacy) {
                            const userCoreResult = tweetResult.core.user_results.result; // Get the user result object
                            const userLegacy = userCoreResult.legacy; // Get the legacy part of the user
                            const tweetUrl = `https://x.com/${userLegacy.screen_name}/status/${tweetResult.rest_id}`;
                            mentions.push({
                                tweetId: tweetResult.rest_id,
                                userId: userCoreResult.rest_id, // Correctly access rest_id from the user result object
                                screenName: userLegacy.screen_name,
                                name: userLegacy.name,
                                tweetText: tweetResult.legacy.full_text,
                                createdAt: tweetResult.legacy.created_at,
                                favoriteCount: tweetResult.legacy.favorite_count,
                                retweetCount: tweetResult.legacy.retweet_count,
                                lang: tweetResult.legacy.lang,
                                tweetUrl: tweetUrl, // Added tweet URL
                                type: 'tweet'
                            });
                        }
                    }
                });
            }
        });
    }
    return mentions;
  }

export { extractAndAnalyzeMentions };