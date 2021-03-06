Paifan User Service
=======

### Summary

A Node.js server that handles the information associates with users,
    including the articles published (only ids, the details are stored in Article Service),
    and the feeds (subscribing users).

This server also has an in-memory Redis cache, which caches the following:

    * Article cache: stores the summary of articles which avoids querying them every time from the Article Server.

    * Feed cache: stores the feeding articles list (for each user).

=======
### Article Cache

Stores the summary of each article with an expiration time.

Each time an article is accessed, the expiration time resets.

The space of each summary is approximately 2KB (less than 10 KB), so we could cache at least 10,000 articles.

The expiration time is currently setted about 7 days.

### Feed Cache

Stores the feeding list for each user, which contains the latest articles of all the authors which this user has been subscribed.

When a request has been received and there is no cache represents, we will look for the database to fetch the feed list and store them to the cache with an expire time.

These lists only contain ids for the articles (the summary could be fetched in Article Cache).

(Not implemented now) Each list has an expiration time because if a user has a lot of subscribers, it will consume much resources to update these list. 

If an article has been published or removed, we should refresh the cache of users who has subscribed this author.
Add this article to the head of list or remove it from the list to those has subscribed this author (not all users subscribed him are in the cache, 
so we only need to update that has been cached).

If an user subscribes/unsubscribes an author, the corresponding cache should be refreshed.