- [ ] Allow users to delete items with reason
    - [ ] disliked item style
    - [ ] item damaged/lost (replace oppurtunity)
    - [ ] poor fit (replace oppurtunity)
    - [ ] 
- [x] Rate limiting
- [x] Stripe integration
- [x] Migrate to Bun
- [ ] Improve UI/UX
- [-] Individual or batch uploads
    - [ ] async batch uploads over aistudio api (some system for defering)
- [ ] Personalization features for pro users
    - [ ] write a bio concatenated into analysis
    - [ ] specific haul shopping"user prompts"
    - [ ] upload user selfie (what color season for hair/complexion)
    - [ ] selfie of that day's fit
        - [ ] allow user to reflect/rate either immediately or defer to EOD
            - [] inbox/notifications (also useful for affiliate marketing feat)
        - [ ] automatically detect the coresponding clothes in closet & tally
            - [] statistics for "load bearing"/high-utility items
        - [ ] annotates events/occasions for that day's fit
- [ ] Knowledge graph (graphitti?)
    - [ ] item addition/removals
    - [ ] timestamped events (worn together)
    - [ ] collectively the above can be used to find replacements/enhance fits
    - [ ] find orphans items to consign/sell (sustainablility, charity?)
    - [ ] timestamp upcoming events (planned & historical)
    - [ ] active and stale hauls (overlap detection and merge)


Note: if graphitti is python we can also pull in python under the same ffi or host (seperate microservice)

Headaches to deal with later:
- [x] Preview enviroment seems to struggle with either botID or clerk cookies because of the dynamic urls of the preview
- [ ] Use the async batch api for the analysis of closet uploads cheaply (bypass with premium feature)
- [-] Integrate Axiom for logging (verify this is complete)
- [ ] Private uploads (~~uploadthing premium or migrate to s3~~ supabase storage)
- [ ] Migrate away from Supabase JS Client to Drizzle ORM (typesafe)