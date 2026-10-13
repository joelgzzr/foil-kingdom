# Graph Report - foil-kingdom  (2026-10-13)

## Corpus Check
- Large corpus: 523 files · ~238,041 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1209 nodes · 3435 edges · 78 communities (62 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Inbox and Notifications
- Cron and Catalog Sync
- Order Processing Webhooks
- Account and Auth Pages
- Home and Static Pages
- Legal and Robots
- Admin and Collection Selection
- Conversation Thread
- Trust and Safety SQL
- Profile and Report Forms
- Scan Card Identification
- Admin Dashboard
- Scan Detect API
- Listing Form and Photos
- shadcn Config
- Collection Filters UI
- Bundle Conversations SQL
- Shipping Label and Addresses
- Listings Data Queries
- Auth Forms and Schemas
- Orders and Shipping SQL
- Scan Flow UI
- Messaging SQL
- TypeScript Config
- Profiles and Addresses SQL
- Ratings and Action Results
- Supabase Clients
- Root Layout and Footer
- Account Menu and Nav
- Runtime Dependencies
- Buyer Shipping Checkout
- Seller Collection Page and OG
- Phone Verification Actions
- Conversation Items Actions
- Card Prints SQL
- Client Scan Pipeline
- Rate Limit Hardening SQL
- Binder Scanner SQL
- Package Manifest
- New Listing and Card Search
- Card Detail Page
- Listing Detail Page
- Addresses Dialogs
- Avatar and Order Refresh
- Seller Collection SQL
- Catalog Browse Page
- Collection Schema
- Dev Dependencies
- Ground Truth Scripts
- Card Catalog SQL
- Listings SQL
- Price Sync Script
- Home Hero and Trust Data
- Database Types
- npm Scripts
- Nav Profile Loading
- Create Order Form
- Wishlist UI Actions
- Card-Centric Listings SQL
- Collection Selection Store
- ESLint Config
- Merge Card Prints SQL
- Minor Cluster 65
- Minor Cluster 66
- Minor Cluster 67
- Minor Cluster 68
- Minor Cluster 69
- Minor Cluster 70

## God Nodes (most connected - your core abstractions)
1. `es` - 108 edges
2. `next` - 100 edges
3. `createClient()` - 92 edges
4. `react` - 63 edges
5. `fail()` - 59 edges
6. `ok()` - 58 edges
7. `requireActiveUser()` - 53 edges
8. `buttonVariants` - 43 edges
9. `Button()` - 38 edges
10. `sonner` - 32 edges

## Surprising Connections (you probably didn't know these)
- `onRemove()` --calls--> `removeAvatarAction()`  [EXTRACTED]
  components/account/AvatarUploader.tsx → lib/actions/profile.ts
- `onSubmit()` --calls--> `updateProfileAction()`  [EXTRACTED]
  components/account/ProfileForm.tsx → lib/actions/profile.ts
- `onSubmit()` --calls--> `updateWhatsappAction()`  [EXTRACTED]
  components/account/WhatsappForm.tsx → lib/actions/profile.ts
- `onSubmit()` --calls--> `signUpAction()`  [EXTRACTED]
  components/auth/SignupForm.tsx → lib/actions/auth.ts
- `onContact()` --calls--> `startConversationAction()`  [EXTRACTED]
  components/collection/CollectionSelection.tsx → lib/actions/messages.ts

## Import Cycles
- None detected.

## Communities (78 total, 16 thin omitted)

### Community 0 - "Inbox and Notifications"
Cohesion: 0.06
Nodes (45): GET(), Inbox(), metadata, metadata, NotificationList(), metadata, OrdersList(), metadata (+37 more)

### Community 1 - "Cron and Catalog Sync"
Cohesion: 0.06
Nodes (51): GET(), isAuthorized(), ref_node_crypto, args, buildReport(), Candidate, chunk(), codeFromNumber() (+43 more)

### Community 2 - "Order Processing Webhooks"
Cohesion: 0.08
Nodes (29): POST(), AddressRow, toShippingAddress(), Admin, applyTrackingEvent(), notifyOrderParties(), purchaseLabel(), STATUS_RANK (+21 more)

### Community 3 - "Account and Auth Pages"
Cohesion: 0.09
Nodes (24): AccountContent(), metadata, GET(), metadata, metadata, ManageListing(), metadata, ProfileForm() (+16 more)

### Community 4 - "Home and Static Pages"
Cohesion: 0.10
Nodes (24): metadata, NotFound(), SellPage(), metadata, SuspendedPage(), CatalogFilters(), CollectionFilters(), COLOR_ORDER (+16 more)

### Community 5 - "Legal and Robots"
Cohesion: 0.11
Nodes (15): metadata, metadata, metadata, metadata, FeatureListingButton(), onClick(), HeaderSearch(), Suggestion (+7 more)

### Community 6 - "Admin and Collection Selection"
Cohesion: 0.16
Nodes (16): Props, Action, listeners, ProviderProps, SelectionContext, SelectionContextValue, CardPicker(), PickedCard (+8 more)

### Community 7 - "Conversation Thread"
Cohesion: 0.10
Nodes (24): metadata, Thread(), ConversationThread(), onOffer(), onRespond(), onSend(), onWhatsapp(), offerBubbleLabel() (+16 more)

### Community 8 - "Trust and Safety SQL"
Cohesion: 0.11
Nodes (23): public.handle_new_rating, public.limit_wishlist_items, public.notify_wishlist_matches, listings_notify_wishlist, public.handle_new_rating(), public.is_moderator(), public.notify_wishlist_matches(), public.ratings (+15 more)

### Community 9 - "Profile and Report Forms"
Cohesion: 0.17
Nodes (13): emptyAddress, Props, Props, Field(), FieldProps, Label(), NativeSelect(), Textarea() (+5 more)

### Community 10 - "Scan Card Identification"
Cohesion: 0.16
Nodes (21): identifyCards(), CatalogCard, codeDistance(), codeTail(), MAX_CANDIDATE_CARDS, namesAgree(), normalizeName(), rankCandidates() (+13 more)

### Community 11 - "Admin Dashboard"
Cohesion: 0.15
Nodes (21): AdminDashboard(), metadata, AdminRowButton(), onClick(), CatalogRecordActions(), run(), ReportActions(), run() (+13 more)

### Community 12 - "Scan Detect API"
Cohesion: 0.14
Nodes (20): maxDuration, POST(), MAX_PAGE_BYTES, readScanImage(), sniffImageType(), toBase64(), assertMockAllowed(), dailyScanPageLimit() (+12 more)

### Community 13 - "Listing Form and Photos"
Cohesion: 0.17
Nodes (21): ListingForm(), onSubmit(), ListingPhotosManager(), onFilesSelected(), onRemove(), ListingStatusControls(), changeStatus(), remove() (+13 more)

### Community 14 - "shadcn Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 15 - "Collection Filters UI"
Cohesion: 0.15
Nodes (16): Props, emptyListing, Props, EXTENSIONS, Props, CONDITIONS, FINISHES, LANGUAGES (+8 more)

### Community 16 - "Bundle Conversations SQL"
Cohesion: 0.17
Nodes (17): public.order_items, public.add_conversation_items(), public.cancel_order(), public.conversation_has_pending_order(), public.conversation_items, public.create_order(), public.make_offer(), public.refresh_conversation_title() (+9 more)

### Community 17 - "Shipping Label and Addresses"
Cohesion: 0.19
Nodes (14): escapeHtml(), GET(), AddressesSection(), AddressForm(), onSubmit(), createAddressAction(), deleteAddressAction(), idSchema (+6 more)

### Community 18 - "Listings Data Queries"
Cohesion: 0.16
Nodes (20): MyListings(), CardOffers(), CardOffer, CardOfferFilters, firstPhoto(), getFeaturedListings(), getOwnListings(), getPrintListings() (+12 more)

### Community 19 - "Auth Forms and Schemas"
Cohesion: 0.16
Nodes (15): LoginInput, loginSchema, SignupInput, signupSchema, phone10, PhoneRequestInput, phoneRequestSchema, PhoneVerifyInput (+7 more)

### Community 20 - "Orders and Shipping SQL"
Cohesion: 0.15
Nodes (20): public.order_charges, order_charges_order_idx, payments_order_idx, payments_set_updated_at, public.cancel_order(), public.create_order(), public.orders, public.payments (+12 more)

### Community 21 - "Scan Flow UI"
Cohesion: 0.14
Nodes (16): PageState, PERCENT_CHOICES, PhotoFile, ScanFlow(), processPhoto(), run(), startScan(), submit() (+8 more)

### Community 22 - "Messaging SQL"
Cohesion: 0.21
Nodes (18): public.handle_new_message, conversations_buyer_idx, conversations_seller_idx, messages_after_insert, messages_conversation_idx, notifications_user_unread_idx, public.conversations, public.handle_new_message() (+10 more)

### Community 23 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 24 - "Profiles and Addresses SQL"
Cohesion: 0.15
Nodes (16): auth.users, public.handle_new_user, public.sync_phone_verified, addresses_one_default_per_user, addresses_set_updated_at, addresses_user_id_idx, on_auth_user_created, on_auth_user_phone_confirmed (+8 more)

### Community 25 - "Ratings and Action Results"
Cohesion: 0.16
Nodes (14): ReportForm(), onSubmit(), ActionErrorCode, ActionResult, submitRatingAction(), submitReportAction(), idSchema, RatingInput (+6 more)

### Community 26 - "Supabase Clients"
Cohesion: 0.22
Nodes (13): Database, required(), supabasePublishableKey(), supabaseUrl(), AUTH_PAGES, matchesPrefix(), PROTECTED_PREFIXES, updateSession() (+5 more)

### Community 27 - "Root Layout and Footer"
Cohesion: 0.13
Nodes (13): app_globals, geistMono, geistSans, metadata, SiteFooter(), SiteHeader(), fill(), LegalDocument() (+5 more)

### Community 28 - "Account Menu and Nav"
Cohesion: 0.17
Nodes (9): Props, KINDS, MarkNotificationsReadButton(), AvatarFallback(), AvatarImage(), Popover(), PopoverContent(), PopoverTrigger() (+1 more)

### Community 29 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, cn, @hookform/resolvers, lucide-react, next, next-themes (+10 more)

### Community 30 - "Buyer Shipping Checkout"
Cohesion: 0.21
Nodes (15): POST(), BuyerShippingFlow(), pay(), CancelOrderButton(), onClick(), cancelOrderAction(), confirmMockPaymentAction(), createOrderAction() (+7 more)

### Community 31 - "Seller Collection Page and OG"
Cohesion: 0.18
Nodes (13): alt, contentType, Image(), size, generateMetadata(), Props, SellerProfile(), ShareCollectionButton() (+5 more)

### Community 32 - "Phone Verification Actions"
Cohesion: 0.25
Nodes (15): PhoneVerificationForm(), onVerify(), sendCode(), firstIssue(), removeAvatarAction(), removeStoredAvatar(), requestPhoneVerificationAction(), setAvatarAction() (+7 more)

### Community 33 - "Conversation Items Actions"
Cohesion: 0.30
Nodes (15): ConversationItemsPanel(), fail(), ok(), addConversationItemsAction(), bundleError(), idSchema, listingIdsSchema, makeOfferAction() (+7 more)

### Community 34 - "Card Prints SQL"
Cohesion: 0.21
Nodes (16): card_prints_card_idx, card_prints_one_default_idx, catalog_source_records_unmatched_idx, public.card_prints, public.catalog_match_overrides, public.catalog_prints, public.catalog_source_records, public.notify_wishlist_matches() (+8 more)

### Community 35 - "Client Scan Pipeline"
Cohesion: 0.25
Nodes (12): compressPage(), cropCard(), decodePhoto(), drawScaled(), toBlob(), ScanErrorCode, CardBox, DetectResponse (+4 more)

### Community 36 - "Rate Limit Hardening SQL"
Cohesion: 0.12
Nodes (15): public.limit_conversation_creation, public.limit_listing_creation, public.limit_message_rate, storage.objects, conversations_rate_limit, listings_rate_limit, messages_rate_limit, public.limit_conversation_creation() (+7 more)

### Community 37 - "Binder Scanner SQL"
Cohesion: 0.15
Nodes (10): c.code, c.name, p.game_id, p.variant_label, print_embeddings_hnsw_idx, public.limit_listing_creation(), public.print_embeddings, public (+2 more)

### Community 38 - "Package Manifest"
Cohesion: 0.14
Nodes (13): name, private, version, react-dom, shadcn, supabase, tailwindcss, @tailwindcss/turbopack (+5 more)

### Community 39 - "New Listing and Card Search"
Cohesion: 0.22
Nodes (9): GET(), metadata, NewListingForm(), CardSummary, CATALOG_PAGE_SIZE, EVENT_LABEL_FILTER, getPrintLabelById(), lookupCards() (+1 more)

### Community 40 - "Card Detail Page"
Cohesion: 0.23
Nodes (9): CardDetail(), first(), generateMetadata(), Props, CardVersions(), getCardBySlug(), getCardVersions(), getPrintListingStats() (+1 more)

### Community 41 - "Listing Detail Page"
Cohesion: 0.22
Nodes (10): generateMetadata(), ListingDetail(), Props, ContactSection(), Props, ReportSection(), WishlistSection(), getCurrentUser (+2 more)

### Community 42 - "Addresses Dialogs"
Cohesion: 0.22
Nodes (6): AddressRow, Dialog(), DialogContent(), DialogHeader(), DialogTitle(), DialogTrigger()

### Community 43 - "Avatar and Order Refresh"
Cohesion: 0.26
Nodes (9): AvatarUploader(), onFileSelected(), onRemove(), Props, AccountMenu(), OrderLiveRefresh(), avatarInitials(), toAvatarBlob() (+1 more)

### Community 44 - "Seller Collection SQL"
Cohesion: 0.19
Nodes (11): public.clear_featured_when_inactive, listings_clear_featured, listings_featured_idx, public.listing_search, public.seller_collection_stats, public.set_listing_featured(), public.card_prints, public.card_set_cards (+3 more)

### Community 45 - "Catalog Browse Page"
Cohesion: 0.27
Nodes (8): CatalogResults(), first(), metadata, CatalogPagination(), pageHref(), PageNav(), CardFilters, searchCards()

### Community 46 - "Collection Schema"
Cohesion: 0.25
Nodes (10): COLLECTION_KINDS, COLLECTION_PAGE_SIZE, COLLECTION_SORTS, CollectionFilters, first(), oneOf(), parseCollectionFilters(), pesosToCents() (+2 more)

### Community 47 - "Dev Dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, sharp, supabase, tailwindcss, @tailwindcss/turbopack, @types/node (+3 more)

### Community 48 - "Ground Truth Scripts"
Cohesion: 0.18
Nodes (8): ref_node_path, sharp, allCodes, cachePath, files, known, supabase, truth

### Community 49 - "Card Catalog SQL"
Cohesion: 0.36
Nodes (10): card_set_cards_card_id_idx, cards_code_trgm_idx, cards_filters_idx, cards_name_trgm_idx, public.card_facets, public.card_set_cards, public.card_sets, public.cards (+2 more)

### Community 51 - "Listings SQL"
Cohesion: 0.27
Nodes (7): public.card_sets, public.can_publish(), public.enforce_listing_publishable(), public.is_in_good_standing(), public.listings, public.games, public.profiles

### Community 52 - "Price Sync Script"
Cohesion: 0.31
Nodes (9): cents(), chunk(), dryRun, getJson(), main(), PriceRow, pricesUrl(), sleep() (+1 more)

### Community 53 - "Home Hero and Trust Data"
Cohesion: 0.33
Nodes (6): WishlistList(), HeroCardFan(), cardImageUrl(), getHeroCards(), getWishlist(), WishlistEntry

### Community 54 - "Database Types"
Cohesion: 0.22
Nodes (8): CompositeTypes, Constants, DatabaseWithoutInternals, DefaultSchema, Enums, Json, TablesInsert, TablesUpdate

### Community 55 - "npm Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, catalog:prices, catalog:sync, catalog:variants, db:test, dev, lint (+1 more)

### Community 56 - "Nav Profile Loading"
Cohesion: 0.36
Nodes (5): NavPopover(), UserNav(), AccountData, getNavProfile, getUnreadCounts()

### Community 57 - "Create Order Form"
Cohesion: 0.43
Nodes (5): Props, PACKAGE_PRESET_IDS, PackagePresetId, CreateOrderInput, createOrderSchema

### Community 58 - "Wishlist UI Actions"
Cohesion: 0.39
Nodes (8): WishlistItemRow(), remove(), savePrice(), WishlistToggle(), onClick(), addToWishlistAction(), removeFromWishlistAction(), updateWishlistMaxPriceAction()

### Community 59 - "Card-Centric Listings SQL"
Cohesion: 0.33
Nodes (6): public.cancel_order(), public.create_order(), public.conversations, public.listing_items, public.listings, public.orders

### Community 60 - "Collection Selection Store"
Cohesion: 0.40
Nodes (5): CollectionSelectionProvider(), onContact(), readRaw(), subscribe(), writeIds()

### Community 61 - "ESLint Config"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 62 - "Merge Card Prints SQL"
Cohesion: 0.50
Nodes (3): public.merge_card_prints(), public.card_prints, public.wishlist_items

## Knowledge Gaps
- **253 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `maxDuration` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Legal and Robots` to `Inbox and Notifications`, `Cron and Catalog Sync`, `Order Processing Webhooks`, `Account and Auth Pages`, `Home and Static Pages`, `Admin and Collection Selection`, `Conversation Thread`, `Profile and Report Forms`, `Admin Dashboard`, `Scan Detect API`, `Listing Form and Photos`, `Collection Filters UI`, `Shipping Label and Addresses`, `Listings Data Queries`, `Auth Forms and Schemas`, `Scan Flow UI`, `Ratings and Action Results`, `Supabase Clients`, `Root Layout and Footer`, `Account Menu and Nav`, `Seller Collection Page and OG`, `Phone Verification Actions`, `Package Manifest`, `New Listing and Card Search`, `Card Detail Page`, `Listing Detail Page`, `Avatar and Order Refresh`, `Catalog Browse Page`, `Home Hero and Trust Data`, `Nav Profile Loading`, `Create Order Form`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `es` connect `Legal and Robots` to `Inbox and Notifications`, `Account and Auth Pages`, `Home and Static Pages`, `Admin and Collection Selection`, `Conversation Thread`, `Profile and Report Forms`, `Admin Dashboard`, `Listing Form and Photos`, `Collection Filters UI`, `Shipping Label and Addresses`, `Auth Forms and Schemas`, `Scan Flow UI`, `Ratings and Action Results`, `Root Layout and Footer`, `Account Menu and Nav`, `Buyer Shipping Checkout`, `Seller Collection Page and OG`, `Phone Verification Actions`, `Conversation Items Actions`, `New Listing and Card Search`, `Card Detail Page`, `Listing Detail Page`, `Addresses Dialogs`, `Avatar and Order Refresh`, `Catalog Browse Page`, `Home Hero and Trust Data`, `Nav Profile Loading`, `Create Order Form`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Shipping Label and Addresses` to `Inbox and Notifications`, `Conversation Items Actions`, `Phone Verification Actions`, `Account and Auth Pages`, `Supabase Clients`, `Conversation Thread`, `Listing Detail Page`, `Admin Dashboard`, `Scan Detect API`, `Listing Form and Photos`, `Listings Data Queries`, `Home Hero and Trust Data`, `Nav Profile Loading`, `Ratings and Action Results`, `Wishlist UI Actions`, `Buyer Shipping Checkout`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Inbox and Notifications` be split into smaller, more focused modules?**
  _Cohesion score 0.058384547848990345 - nodes in this community are weakly interconnected._
- **Should `Cron and Catalog Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.06386066763425254 - nodes in this community are weakly interconnected._
- **Should `Order Processing Webhooks` be split into smaller, more focused modules?**
  _Cohesion score 0.07729468599033816 - nodes in this community are weakly interconnected._