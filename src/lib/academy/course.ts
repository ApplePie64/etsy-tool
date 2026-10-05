import type { TabId } from "../tabs";

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Lesson {
  day: number;
  title: string;
  goal: string;
  minutes: number;
  sections: LessonSection[];
  takeaways: string[];
  quiz: QuizQuestion[];
  apply: { text: string; tab: TabId; cta: string };
}

/**
 * A one-week course: one lesson a day, each ending with a short quiz and a
 * task to do in the tool. Written from Etsy's public Seller Handbook guidance
 * plus common seller practice; policies change, so lessons say "check the
 * current rules" where it matters.
 */
export const COURSE: Lesson[] = [
  {
    day: 1,
    title: "How Etsy search really works",
    goal: "Understand the two steps every search goes through, so you know what you can control.",
    minutes: 15,
    sections: [
      {
        heading: "Step 1: query matching",
        paragraphs: [
          "When a shopper types \"gold initial necklace\", Etsy first collects every listing that could match. It looks at your title, your 13 tags, your category and your attributes. If none of those contain the shopper's words, your listing isn't even in the running — no matter how good it is.",
          "This is why keywords matter so much. They're the ticket into the room. Etsy treats plurals and word order sensibly, so \"necklaces gold initial\" can still match. Using your main phrase in both your title and your tags makes sure it can be matched wherever Etsy looks.",
        ],
      },
      {
        heading: "Step 2: ranking",
        paragraphs: ["Of the listings that matched, Etsy decides the order. It describes these main factors publicly:"],
        bullets: [
          "Relevancy — how closely your title, tags, categories and attributes match the search.",
          "Listing quality score — how shoppers respond when your listing is shown: clicks, favourites and especially purchases.",
          "Recency — new and renewed listings get a short, temporary boost while Etsy learns how shoppers respond.",
          "Customer & market experience — reviews, a complete About section and policies, on-time shipping. Policy violations push you down.",
          "Shipping price — for US shoppers, free shipping (or the free-shipping guarantee on US orders $35+) gets priority.",
          "Shopper context — language, location and each shopper's own history personalise results.",
        ],
      },
      {
        heading: "What this means for you",
        paragraphs: [
          "You fully control relevancy (keywords) and much of customer experience. You influence listing quality through photos, price and trust. You can't control shopper context — so two people can see different rankings for the same search. Don't panic when your listing isn't on page one on your own phone.",
          "The loop that grows a shop: good keywords get you shown → good photos and prices get clicks and sales → sales raise your quality score → you get shown more.",
        ],
      },
    ],
    takeaways: [
      "No keyword match = no chance to rank. Keywords come first.",
      "After matching, shopper behaviour (clicks, sales) decides ranking.",
      "Free shipping and a complete shop profile are ranking factors you control.",
    ],
    quiz: [
      {
        q: "A shopper searches \"sage green ceramic mug\". Your mug is sage green but the title and tags only say \"handmade mug\". What happens?",
        options: ["It ranks lower but still shows", "It probably isn't retrieved for that search at all", "Etsy reads your photos and adds the colour", "It ranks higher because \"handmade\" is favoured"],
        answer: 1,
        explain: "Query matching looks at title, tags, category and attributes. Setting the colour attribute and using \"sage green\" in tags would get it retrieved.",
      },
      {
        q: "Which of these is NOT one of the ranking factors Etsy describes?",
        options: ["Listing quality score", "Recency", "How many times a keyword is repeated in your title", "Shipping price"],
        answer: 2,
        explain: "Repeating a word doesn't add relevancy. Etsy recommends concise, readable titles.",
      },
      {
        q: "Why might your listing rank #3 for you but #20 for your friend?",
        options: ["Etsy is broken", "Search results are personalised by shopper context", "Your friend is on a different Etsy", "Rankings change every second at random"],
        answer: 1,
        explain: "Location, language and each shopper's history personalise results.",
      },
    ],
    apply: { text: "Paste one of your listings into the SEO Lab to see how it scores on relevancy basics.", tab: "seo", cta: "Open SEO Lab" },
  },
  {
    day: 2,
    title: "Keyword research & writing titles",
    goal: "Find the phrases buyers type and write titles that are both findable and readable.",
    minutes: 20,
    sections: [
      {
        heading: "Think like a buyer, not a maker",
        paragraphs: [
          "You call it a \"hand-thrown stoneware vessel\". Buyers type \"ceramic vase\". The best keywords describe what the item is in plain words, then add the details shoppers filter on: material, colour, style, size, who it's for and the occasion.",
        ],
      },
      {
        heading: "Free research methods that work",
        paragraphs: ["You don't need paid tools to start:"],
        bullets: [
          "Etsy search autocomplete: type your product slowly and write down the suggestions — they come from real searches.",
          "Your own Stats: the search terms section shows which phrases already bring visits and orders. Double down on those.",
          "Top results: search your main keyword and read the titles of the first 10 listings. Note repeated phrases, but don't copy.",
          "Related searches and filters: the category and attribute filters show how Etsy organises your product.",
        ],
      },
      {
        heading: "Long-tail beats broad",
        paragraphs: [
          "\"Necklace\" has huge competition and vague intent. \"Personalized initial necklace gold\" has fewer searches but a shopper who knows what they want — and far fewer competitors. New shops should target long-tail phrases of 2–4 words.",
        ],
      },
      {
        heading: "Title formula",
        paragraphs: [
          "Etsy recommends short, descriptive titles that clearly say what the item is. Put your most important keyword first — mobile search cuts titles after about 40–50 characters.",
          "A good pattern: [Main keyword] + [key detail] + [secondary phrase]. For example: \"Gold Initial Necklace, Dainty Personalized Letter Pendant\". Say each idea once; repeating words doesn't add ranking and reads as spam.",
        ],
      },
    ],
    takeaways: [
      "Use Etsy autocomplete and your Stats search terms for research.",
      "Target 2–4 word long-tail phrases, especially as a newer shop.",
      "Main keyword first; one readable description; no repeated words.",
    ],
    quiz: [
      {
        q: "Which title is best for a gold initial necklace?",
        options: [
          "NECKLACE Necklace necklace gold initial necklace gift necklace",
          "Gold Initial Necklace, Dainty Personalized Letter Pendant",
          "Beautiful Handmade Treasure for Someone Special",
          "Necklace",
        ],
        answer: 1,
        explain: "It leads with the main keyword, adds key details, and reads naturally.",
      },
      {
        q: "Where do Etsy search autocomplete suggestions come from?",
        options: ["Random words", "Real shopper searches", "Seller tags only", "Paid advertisers"],
        answer: 1,
        explain: "Autocomplete reflects what shoppers commonly search, which makes it a free keyword tool.",
      },
      {
        q: "Why should a new shop prefer long-tail keywords?",
        options: ["They're longer so they rank higher", "Less competition and clearer buyer intent", "Etsy requires them", "They cost less in ads"],
        answer: 1,
        explain: "Specific phrases have fewer competing listings and shoppers who are closer to buying.",
      },
    ],
    apply: { text: "Rewrite one title in the SEO Lab and watch the title checks turn green.", tab: "seo", cta: "Open SEO Lab" },
  },
  {
    day: 3,
    title: "Tags, attributes & categories",
    goal: "Use every free slot Etsy gives you to be found for more searches.",
    minutes: 15,
    sections: [
      {
        heading: "13 tags = 13 doors into search",
        paragraphs: [
          "Every listing gets 13 tags of up to 20 characters. Use all of them, and use phrases, not single words. \"Boho wall hanging\" matches more specific searches than \"boho\" and \"wall\" separately.",
        ],
        bullets: [
          "Cover different angles: what it is, who it's for, the occasion, the style, the material.",
          "Repeat your most important title phrase as a tag, so it appears in both places Etsy matches on.",
          "Don't waste slots on plurals, reorderings, or your category name — Etsy already matches those.",
          "Avoid misspellings and other brands' trademarks.",
        ],
      },
      {
        heading: "Attributes are extra tags",
        paragraphs: [
          "Colour, occasion, holiday, style, material and other attributes act like tags and power the filters shoppers click. A shopper filtering by \"Mother's Day\" won't see a listing that didn't set that occasion. Fill in every attribute that honestly applies.",
        ],
      },
      {
        heading: "Pick the most specific category",
        paragraphs: [
          "Categories also count as keywords. \"Jewelry → Necklaces → Pendants\" is better than stopping at \"Jewelry\". Since the category already matches, you can spend your tags on other phrases.",
        ],
      },
    ],
    takeaways: [
      "Use all 13 tags, as multi-word phrases across different angles.",
      "Attributes and categories work like extra tags and filters — fill them all.",
      "Don't spend tags on plurals, reorderings or your category name.",
    ],
    quiz: [
      {
        q: "Your tags include \"ring\", \"rings\" and \"gold ring\". What's the problem?",
        options: ["Nothing", "\"ring\" and \"rings\" waste a slot and single words are weak", "Tags can't include metals", "You need more single words"],
        answer: 1,
        explain: "Etsy matches plurals, so one of them is wasted, and single-word tags face heavy competition.",
      },
      {
        q: "What's the maximum length of an Etsy tag?",
        options: ["10 characters", "20 characters", "40 characters", "140 characters"],
        answer: 1,
        explain: "Tags max out at 20 characters; titles at 140.",
      },
      {
        q: "A shopper filters for the \"Wedding\" occasion. Which listing can appear?",
        options: ["Any listing with \"wedding\" in the description", "Listings with the Wedding occasion attribute set", "Only listings in the Weddings category", "Listings with the most favourites"],
        answer: 1,
        explain: "Filters rely on attributes, so setting them makes you eligible for filtered searches.",
      },
    ],
    apply: { text: "Use the SEO Lab tag suggestions to fill all 13 tags on one listing.", tab: "seo", cta: "Open SEO Lab" },
  },
  {
    day: 4,
    title: "Photos, video & conversion",
    goal: "Turn the visits you get into sales — which in turn improves your ranking.",
    minutes: 20,
    sections: [
      {
        heading: "Photo 1 wins the click",
        paragraphs: [
          "In search results, shoppers see a grid of thumbnails. Your first photo must read clearly at thumbnail size: bright, natural light, the product filling most of the frame, a simple background. Check how it crops to a square and to Etsy's thumbnail shape.",
        ],
      },
      {
        heading: "Use the photo slots",
        paragraphs: ["Etsy allows up to 20 photos and one video. Aim for at least 10 photos that answer questions before they're asked:"],
        bullets: [
          "Scale: in a hand, on a person, next to a common object.",
          "Detail close-ups of texture, clasp, stitching, finish.",
          "Lifestyle: the item in use or in a styled room.",
          "Variations: every colour or size you offer.",
          "What's included / packaging / gift wrapping.",
          "A 5–15 second video. It plays in search and on the listing page.",
        ],
      },
      {
        heading: "The listing page closes the sale",
        paragraphs: [
          "Start the description with one plain sentence using your main keyword (Google shows this as the snippet), then cover size, materials, care, personalisation and timing. Reviews, clear policies and fast replies to messages build trust.",
          "Conversion rate = orders ÷ visits. For most physical-goods shops, 1–3% is a common range. If you have plenty of visits but few orders, look at photo 1, price, shipping cost and reviews — in that order.",
        ],
      },
    ],
    takeaways: [
      "Photo 1 must read clearly as a thumbnail.",
      "Use 10+ photos and a short video to answer buyer questions visually.",
      "Low conversion with good traffic? Check photo, price, shipping, reviews.",
    ],
    quiz: [
      {
        q: "You have 400 visits and 1 order this month. What should you look at first?",
        options: ["Add more tags", "Photo 1, price and shipping cost", "Post more on Instagram", "Change your shop name"],
        answer: 1,
        explain: "Traffic isn't the problem — the listing isn't persuading. Photo, price and shipping are the biggest levers.",
      },
      {
        q: "How many photos can an Etsy listing have?",
        options: ["5", "10", "Up to 20, plus a video", "Unlimited"],
        answer: 2,
        explain: "Etsy raised the limit to 20 photos per listing, plus one video.",
      },
      {
        q: "What's a listing's conversion rate?",
        options: ["Favourites ÷ views", "Orders ÷ visits", "Revenue ÷ orders", "Visits ÷ listings"],
        answer: 1,
        explain: "Revenue ÷ orders is average order value; orders ÷ visits is conversion.",
      },
    ],
    apply: { text: "Enter your stats in Shop Stats to see your conversion rate against your seller type.", tab: "stats", cta: "Open Shop Stats" },
  },
  {
    day: 5,
    title: "Pricing, fees, shipping & offers",
    goal: "Make sure every sale is profitable, and use pricing tools that raise order value.",
    minutes: 20,
    sections: [
      {
        heading: "Know your fees",
        paragraphs: ["The main Etsy fees (US rates; check current rates for your country):"],
        bullets: [
          "Listing fee: $0.20 per listing, renewed every 4 months or when it sells.",
          "Transaction fee: 6.5% of the item price plus shipping and gift wrap.",
          "Payment processing: in the US, 3% + $0.25 per order (varies by country).",
          "Offsite Ads: 15% of the order (12% if your shop made $10k+ in the past year, when it becomes mandatory), capped at $100, only on orders from those ads.",
        ],
      },
      {
        heading: "Price for profit, not to be cheapest",
        paragraphs: [
          "A simple formula: materials + your time at a fair hourly rate + overhead + fees + profit. Then compare with the market. Underpricing is the most common mistake — it trains buyers to expect low prices and leaves no room for ads, sales or wholesale.",
        ],
      },
      {
        heading: "Shipping",
        paragraphs: [
          "For US shoppers, Etsy prioritises listings with free shipping. Many sellers build shipping cost into the item price. Offering free shipping on US orders of $35+ (the free-shipping guarantee) also encourages buyers to add a second item.",
        ],
      },
      {
        heading: "Offers that raise order value",
        paragraphs: ["Etsy's Marketing → Sales and discounts section has tools worth using:"],
        bullets: [
          "Targeted offers to shoppers who favourited an item or abandoned a cart.",
          "Thank-you coupons for repeat purchases.",
          "Sales like \"buy 2, save 10%\" and bundles or sets as their own listings.",
        ],
      },
    ],
    takeaways: [
      "Fees take roughly 10%+ of each order before costs — price for it.",
      "Free shipping is a US search priority; build it into prices.",
      "Use targeted offers and bundles to lift conversion and order value.",
    ],
    quiz: [
      {
        q: "On a $30 order (item + shipping) in the US, roughly what do the transaction and processing fees come to?",
        options: ["About $0.50", "About $3.10", "About $9", "Nothing — Etsy is free"],
        answer: 1,
        explain: "6.5% × $30 = $1.95, plus 3% × $30 + $0.25 = $1.15, for about $3.10 (plus the $0.20 listing fee).",
      },
      {
        q: "Why is underpricing risky?",
        options: ["Etsy bans cheap items", "It leaves no margin for ads, sales or growth", "Cheap items rank lower by rule", "Buyers can't pay less than $10"],
        answer: 1,
        explain: "Thin margins mean ads, coupons and wholesale become unaffordable.",
      },
      {
        q: "Which tool lets you send a discount to people who favourited your item?",
        options: ["Etsy Ads", "Targeted offers in Sales and discounts", "Shop announcement", "Offsite Ads"],
        answer: 1,
        explain: "Targeted offers go to favouriters and abandoned-cart shoppers automatically.",
      },
    ],
    apply: { text: "Run your best seller through the profit calculator in Shop Stats.", tab: "stats", cta: "Open profit calculator" },
  },
  {
    day: 6,
    title: "Traffic: ads, Pinterest, social & Google",
    goal: "Understand each traffic source and add one beyond Etsy search.",
    minutes: 20,
    sections: [
      {
        heading: "Read your traffic sources",
        paragraphs: ["Etsy Stats splits visits into sources. Each tells you something different:"],
        bullets: [
          "Etsy search — organic search traffic. Driven by SEO and listing quality.",
          "Etsy app & other Etsy pages — browsing, recommendations, \"more from this shop\", favourites.",
          "Etsy Ads — paid clicks from on-Etsy ads.",
          "Etsy marketing & SEO — Etsy's own marketing, including Offsite Ads on Google, social and elsewhere.",
          "Social media — Pinterest, Instagram, TikTok, Facebook links.",
          "Direct & other — typed URLs, email, other websites.",
        ],
      },
      {
        heading: "Etsy Ads, carefully",
        paragraphs: [
          "Etsy Ads charge per click. Only advertise listings that already convert, start with a small daily budget, and judge results after about 30 days. Compute your break-even ROAS: 1 ÷ your profit margin. With a 35% margin you need at least $2.86 in ad revenue per $1 spent.",
        ],
      },
      {
        heading: "Pinterest and social",
        paragraphs: [
          "Pinterest behaves like a visual search engine and suits decor, weddings, printables, fashion and gifts. Pin each listing with a keyword-rich description. Instagram and TikTok reward process videos and behind-the-scenes content; they build an audience that comes back.",
        ],
      },
      {
        heading: "Google",
        paragraphs: [
          "Listings can appear in Google results. Google uses your title and the opening of your description, which is why the first sentence should plainly describe the item with your main keyword.",
        ],
      },
    ],
    takeaways: [
      "Each traffic source reflects a different lever — read them weekly.",
      "Ads only on proven listings, judged against break-even ROAS.",
      "Pick one external channel (often Pinterest) and be consistent.",
    ],
    quiz: [
      {
        q: "Your margin is 25%. What ROAS do Etsy Ads need to break even?",
        options: ["1×", "2×", "4×", "25×"],
        answer: 2,
        explain: "Break-even ROAS = 1 ÷ margin = 1 ÷ 0.25 = 4×.",
      },
      {
        q: "Which listings should you advertise first?",
        options: ["Newest listings with no sales", "Listings that already convert well", "Your most expensive items only", "All listings equally"],
        answer: 1,
        explain: "Ads amplify what already works; a listing that doesn't convert organically won't convert paid clicks either.",
      },
      {
        q: "What does the \"Etsy marketing & SEO\" source include?",
        options: ["Your Instagram posts", "Etsy's own marketing, including Offsite Ads", "Your Etsy Ads", "Direct URL visits"],
        answer: 1,
        explain: "It covers Etsy's marketing on other sites, including Offsite Ads.",
      },
    ],
    apply: { text: "Enter your traffic sources and ad spend in Shop Stats to check your mix and ROAS.", tab: "stats", cta: "Open Shop Stats" },
  },
  {
    day: 7,
    title: "Reading your stats, seller types & your weekly ritual",
    goal: "Turn numbers into decisions, know which kind of seller you are, and set a weekly routine.",
    minutes: 20,
    sections: [
      {
        heading: "The funnel",
        paragraphs: [
          "Visits → listing views → favourites → orders. Each step tells you where the leak is. Few visits: a visibility (SEO) problem. Visits but no orders: a persuasion problem (photos, price, trust). Orders but low revenue: an order-value problem (bundles, pricing).",
          "Judge rates over at least 4 weeks and ~100 visits. One week is noise.",
        ],
      },
      {
        heading: "Different sellers, different numbers",
        paragraphs: [
          "A digital-download shop might convert at 3% with $8 orders; a vintage shop at 1% with $80 orders. Both can be healthy. Compare yourself with shops like yours, and most of all with your own trend.",
        ],
        bullets: [
          "Launch (0–10 sales): focus on getting found — listings and SEO.",
          "Traction (10–100): find what sells; fix listings with views but no sales.",
          "Growth (100–1,000): raise order value, add a channel you own, batch work.",
          "Established (1,000+): profitability, ads discipline, less reliance on one listing.",
        ],
      },
      {
        heading: "A 1-hour weekly ritual",
        paragraphs: ["Pick the same day each week:"],
        bullets: [
          "10 min — record last week's stats and compare with the week before.",
          "10 min — find the biggest change and its source.",
          "30 min — improve 3–5 listings (titles, tags, photo 1).",
          "10 min — plan one traffic action and one listing to create.",
        ],
      },
    ],
    takeaways: [
      "Find the leak in the funnel before you act.",
      "Benchmarks differ by seller type; your own trend matters most.",
      "One focused hour a week compounds.",
    ],
    quiz: [
      {
        q: "Visits are steady but orders dropped to zero this week after 3 good weeks. Best first move?",
        options: ["Panic and rewrite every listing", "Check 4-week totals and whether a key listing sold out or expired", "Double ad spend", "Lower all prices 30%"],
        answer: 1,
        explain: "One week is noise; a sold-out or expired bestseller is a common, fixable cause.",
      },
      {
        q: "Which shop is doing better: A (3% conversion, $8 orders) or B (1% conversion, $80 orders), both with 1,000 visits?",
        options: ["A", "B", "They're the same", "Can't have 1% conversion"],
        answer: 1,
        explain: "A: 30 orders × $8 = $240. B: 10 orders × $80 = $800. Revenue per visit matters, not conversion alone.",
      },
      {
        q: "At which stage should you mostly ignore conversion rate?",
        options: ["Launch", "Traction", "Growth", "Established"],
        answer: 0,
        explain: "With very few visits, conversion rates are too noisy to act on.",
      },
    ],
    apply: { text: "Find your seller type and stage, then open your personalised 7-day plan.", tab: "sellers", cta: "Open Seller Types" },
  },
];
