- [x] Allow users to delete items with reason
    - [x] disliked item style
    - [x] item damaged/lost (replace oppurtunity)
    - [x] poor fit (replace oppurtunity)
    - [ ] allow user to enter custom reason after selecting other (leveraging llm)
- [x] Rate limiting
- [x] Stripe integration
- [x] Migrate to Bun
- [ ] Improve UI/UX
- [-] Individual or batch uploads
    - [ ] async batch uploads over aistudio api (some system for defering)
- [ ] Personalization features for pro users
    - [x] write a bio concatenated into analysis
        - [ ] optimistically fill out default bio based on user's zep context
    - [ ] specific haul shopping "user prompts"
    - [x] upload user selfie (what color season for hair/complexion)
    - [ ] selfie of that day's fit
        - [ ] allow user to reflect/rate either immediately or defer to EOD
            - [] inbox/notifications (also useful for affiliate marketing feat)
        - [ ] automatically detect the coresponding clothes in closet & tally
            - [] statistics for "load bearing"/high-utility items
        - [ ] annotates events/occasions for that day's fit
- [ ] Knowledge graph (graphitti?)
    - [x] item addition/removals
    - [ ] timestamped events (worn together)
    - [ ] collectively the above can be used to find replacements/enhance fits
    - [ ] find orphans items to consign/sell (sustainablility, charity?)
    - [ ] timestamp upcoming events (planned & historical)
    - [ ] active and stale hauls (overlap detection and merge)


Note: if graphitti is python we can also pull in python under the same ffi or host (seperate microservice)

Headaches to deal with later:
- [x] Preview enviroment seems to struggle with either botID or clerk cookies because of the dynamic urls of the preview
- [ ] Use the async batch api for the analysis of closet uploads cheaply (bypass with premium feature)
- [x] Integrate Axiom for logging (verify this is complete)
- [x] Private uploads (Convex File Storage)
- [x] Migrate data + sync to Convex
- [ ] Look into referer policies for our file storage (Convex or R2)
    - note: this adresses my file hotlinking fears regardless of public/private urls
- [ ] Release gate: rotate all production secrets (Clerk, Stripe, Supabase, Axiom, QStash, Gemini) before public launch
