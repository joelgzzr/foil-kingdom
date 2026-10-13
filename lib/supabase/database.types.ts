
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "created_at": string,"exterior_number": string,"id": string,"interior_number": string | null,"is_default": boolean,"label": string | null,"municipality": string,"neighborhood": string,"phone": string,"postal_code": string,"recipient_name": string,"reference": string | null,"state": string,"street": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exterior_number": string,"id"?: string,"interior_number"?: string | null,"is_default"?: boolean,"label"?: string | null,"municipality": string,"neighborhood": string,"phone": string,"postal_code": string,"recipient_name": string,"reference"?: string | null,"state": string,"street": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exterior_number"?: string,"id"?: string,"interior_number"?: string | null,"is_default"?: boolean,"label"?: string | null,"municipality"?: string,"neighborhood"?: string,"phone"?: string,"postal_code"?: string,"recipient_name"?: string,"reference"?: string | null,"state"?: string,"street"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"card_prints": {
                  Row: {
                    "card_id": string,"created_at": string,"game_id": string,"id": string,"image_path": string | null,"image_sha256": string | null,"image_source": string | null,"is_default": boolean,"slug": string,"tcgplayer_product_id": number | null,"variant_label": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"created_at"?: string,"game_id": string,"id"?: string,"image_path"?: string | null,"image_sha256"?: string | null,"image_source"?: string | null,"is_default"?: boolean,"slug": string,"tcgplayer_product_id"?: number | null,"variant_label"?: string | null
                  }
                  Update: {
                    "card_id"?: string,"created_at"?: string,"game_id"?: string,"id"?: string,"image_path"?: string | null,"image_sha256"?: string | null,"image_source"?: string | null,"is_default"?: boolean,"slug"?: string,"tcgplayer_product_id"?: number | null,"variant_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_prints_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_prints_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"card_set_cards": {
                  Row: {
                    "card_id": string,"set_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"set_id": string
                  }
                  Update: {
                    "card_id"?: string,"set_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_set_cards_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_set_cards_set_id_fkey"
      columns: ["set_id"]
isOneToOne: false
      referencedRelation: "card_sets"
      referencedColumns: ["id"]
    }
                  ]
                },"card_sets": {
                  Row: {
                    "created_at": string,"game_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_sets_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "attribute": string | null,"card_type": string | null,"code": string,"color": string | null,"color2": string | null,"created_at": string,"digi_types": (string)[],"dp": number | null,"evolution_cost": number | null,"form": string | null,"game_id": string,"id": string,"level": number | null,"main_effect": string | null,"name": string,"play_cost": number | null,"rarity": string | null,"source": string,"source_effect": string | null,"stage": string | null,"synced_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attribute"?: string | null,"card_type"?: string | null,"code": string,"color"?: string | null,"color2"?: string | null,"created_at"?: string,"digi_types"?: (string)[],"dp"?: number | null,"evolution_cost"?: number | null,"form"?: string | null,"game_id": string,"id"?: string,"level"?: number | null,"main_effect"?: string | null,"name": string,"play_cost"?: number | null,"rarity"?: string | null,"source"?: string,"source_effect"?: string | null,"stage"?: string | null,"synced_at"?: string
                  }
                  Update: {
                    "attribute"?: string | null,"card_type"?: string | null,"code"?: string,"color"?: string | null,"color2"?: string | null,"created_at"?: string,"digi_types"?: (string)[],"dp"?: number | null,"evolution_cost"?: number | null,"form"?: string | null,"game_id"?: string,"id"?: string,"level"?: number | null,"main_effect"?: string | null,"name"?: string,"play_cost"?: number | null,"rarity"?: string | null,"source"?: string,"source_effect"?: string | null,"stage"?: string | null,"synced_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_match_overrides": {
                  Row: {
                    "code": string | null,"created_at": string,"external_id": string,"ignore": boolean,"note": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"external_id": string,"ignore"?: boolean,"note"?: string | null,"source": string
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"external_id"?: string,"ignore"?: boolean,"note"?: string | null,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalog_source_records": {
                  Row: {
                    "card_id": string | null,"external_id": string,"first_seen_at": string,"game_id": string,"id": string,"kind": string,"last_seen_at": string,"match_method": string,"number": string | null,"payload": NonNullable<Json>,"print_id": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id"?: string | null,"external_id": string,"first_seen_at"?: string,"game_id": string,"id"?: string,"kind": string,"last_seen_at"?: string,"match_method": string,"number"?: string | null,"payload": NonNullable<Json>,"print_id"?: string | null,"source": string
                  }
                  Update: {
                    "card_id"?: string | null,"external_id"?: string,"first_seen_at"?: string,"game_id"?: string,"id"?: string,"kind"?: string,"last_seen_at"?: string,"match_method"?: string,"number"?: string | null,"payload"?: NonNullable<Json>,"print_id"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_source_records_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_source_records_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_source_records_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "card_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_source_records_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "catalog_prints"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_sync_runs": {
                  Row: {
                    "cards_upserted": number,"error": string | null,"finished_at": string | null,"game_id": string,"id": string,"images_downloaded": number,"prints_upserted": number,"report": Json | null,"started_at": string,"status": string,"unmatched_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cards_upserted"?: number,"error"?: string | null,"finished_at"?: string | null,"game_id": string,"id"?: string,"images_downloaded"?: number,"prints_upserted"?: number,"report"?: Json | null,"started_at"?: string,"status"?: string,"unmatched_count"?: number
                  }
                  Update: {
                    "cards_upserted"?: number,"error"?: string | null,"finished_at"?: string | null,"game_id"?: string,"id"?: string,"images_downloaded"?: number,"prints_upserted"?: number,"report"?: Json | null,"started_at"?: string,"status"?: string,"unmatched_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_sync_runs_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_items": {
                  Row: {
                    "added_by": string | null,"agreed_price_cents": number | null,"conversation_id": string,"created_at": string,"id": string,"listing_id": string,"order_id": string | null,"quantity": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"agreed_price_cents"?: number | null,"conversation_id": string,"created_at"?: string,"id"?: string,"listing_id": string,"order_id"?: string | null,"quantity"?: number,"title": string
                  }
                  Update: {
                    "added_by"?: string | null,"agreed_price_cents"?: number | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"listing_id"?: string,"order_id"?: string | null,"quantity"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_items_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "agreed_bundle_cents": number | null,"buyer_id": string,"buyer_last_read_at": string,"created_at": string,"id": string,"last_message_at": string,"last_message_kind": string | null,"last_message_preview": string | null,"last_message_sender_id": string | null,"listing_title": string,"seller_id": string,"seller_last_read_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_bundle_cents"?: number | null,"buyer_id": string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_kind"?: string | null,"last_message_preview"?: string | null,"last_message_sender_id"?: string | null,"listing_title": string,"seller_id": string,"seller_last_read_at"?: string
                  }
                  Update: {
                    "agreed_bundle_cents"?: number | null,"buyer_id"?: string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_kind"?: string | null,"last_message_preview"?: string | null,"last_message_sender_id"?: string | null,"listing_title"?: string,"seller_id"?: string,"seller_last_read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_last_message_sender_id_fkey"
      columns: ["last_message_sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"listing_items": {
                  Row: {
                    "condition": string,"created_at": string,"finish": string,"id": string,"language": string,"listing_id": string,"print_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "condition": string,"created_at"?: string,"finish"?: string,"id"?: string,"language"?: string,"listing_id": string,"print_id": string,"quantity"?: number
                  }
                  Update: {
                    "condition"?: string,"created_at"?: string,"finish"?: string,"id"?: string,"language"?: string,"listing_id"?: string,"print_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "card_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "catalog_prints"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_photos": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string,"position": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id": string,"position"?: number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string,"position"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "accepts_offers": boolean,"created_at": string,"description": string | null,"featured_at": string | null,"game_id": string,"id": string,"kind": Database["public"]['Enums']["listing_kind"],"price_cents": number,"published_at": string | null,"sealed_type": string | null,"seller_id": string,"set_id": string | null,"source": string,"status": Database["public"]['Enums']["listing_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_offers"?: boolean,"created_at"?: string,"description"?: string | null,"featured_at"?: string | null,"game_id": string,"id"?: string,"kind": Database["public"]['Enums']["listing_kind"],"price_cents": number,"published_at"?: string | null,"sealed_type"?: string | null,"seller_id": string,"set_id"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["listing_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "accepts_offers"?: boolean,"created_at"?: string,"description"?: string | null,"featured_at"?: string | null,"game_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"],"price_cents"?: number,"published_at"?: string | null,"sealed_type"?: string | null,"seller_id"?: string,"set_id"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["listing_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_set_id_fkey"
      columns: ["set_id"]
isOneToOne: false
      referencedRelation: "card_sets"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"conversation_id": string,"created_at": string,"id": string,"kind": string,"offer_cents": number | null,"offer_item_id": string | null,"offer_scope": string | null,"offer_status": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"kind"?: string,"offer_cents"?: number | null,"offer_item_id"?: string | null,"offer_scope"?: string | null,"offer_status"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"offer_cents"?: number | null,"offer_item_id"?: string | null,"offer_scope"?: string | null,"offer_status"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_offer_item_id_fkey"
      columns: ["offer_item_id"]
isOneToOne: false
      referencedRelation: "conversation_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "conversation_id": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"read_at": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_addresses": {
                  Row: {
                    "exterior_number": string,"interior_number": string | null,"municipality": string,"neighborhood": string,"order_id": string,"party": string,"phone": string,"postal_code": string,"recipient_name": string,"reference": string | null,"state": string,"street": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exterior_number": string,"interior_number"?: string | null,"municipality": string,"neighborhood": string,"order_id": string,"party": string,"phone": string,"postal_code": string,"recipient_name": string,"reference"?: string | null,"state": string,"street": string
                  }
                  Update: {
                    "exterior_number"?: string,"interior_number"?: string | null,"municipality"?: string,"neighborhood"?: string,"order_id"?: string,"party"?: string,"phone"?: string,"postal_code"?: string,"recipient_name"?: string,"reference"?: string | null,"state"?: string,"street"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_addresses_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_charges": {
                  Row: {
                    "amount_cents": number,"description": string,"id": string,"kind": string,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"description": string,"id"?: string,"kind": string,"order_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"description"?: string,"id"?: string,"kind"?: string,"order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_charges_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "agreed_price_cents": number,"condition": string | null,"created_at": string,"finish": string | null,"id": string,"language": string | null,"listing_id": string | null,"order_id": string,"quantity": number,"title": string,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_price_cents": number,"condition"?: string | null,"created_at"?: string,"finish"?: string | null,"id"?: string,"language"?: string | null,"listing_id"?: string | null,"order_id": string,"quantity": number,"title": string,"unit_price_cents": number
                  }
                  Update: {
                    "agreed_price_cents"?: number,"condition"?: string | null,"created_at"?: string,"finish"?: string | null,"id"?: string,"language"?: string | null,"listing_id"?: string | null,"order_id"?: string,"quantity"?: number,"title"?: string,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_search"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "buyer_id": string,"conversation_id": string,"created_at": string,"destination_summary": string | null,"height_cm": number,"id": string,"item_price_cents": number,"label_error": string | null,"length_cm": number,"listing_title": string,"origin_summary": string,"package_preset": string,"selected_quote_id": string | null,"seller_id": string,"status": Database["public"]['Enums']["order_status"],"total_cents": number | null,"updated_at": string,"weight_grams": number,"width_cm": number
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"conversation_id": string,"created_at"?: string,"destination_summary"?: string | null,"height_cm": number,"id"?: string,"item_price_cents": number,"label_error"?: string | null,"length_cm": number,"listing_title": string,"origin_summary": string,"package_preset": string,"selected_quote_id"?: string | null,"seller_id": string,"status"?: Database["public"]['Enums']["order_status"],"total_cents"?: number | null,"updated_at"?: string,"weight_grams": number,"width_cm": number
                  }
                  Update: {
                    "buyer_id"?: string,"conversation_id"?: string,"created_at"?: string,"destination_summary"?: string | null,"height_cm"?: number,"id"?: string,"item_price_cents"?: number,"label_error"?: string | null,"length_cm"?: number,"listing_title"?: string,"origin_summary"?: string,"package_preset"?: string,"selected_quote_id"?: string | null,"seller_id"?: string,"status"?: Database["public"]['Enums']["order_status"],"total_cents"?: number | null,"updated_at"?: string,"weight_grams"?: number,"width_cm"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_selected_quote_fk"
      columns: ["selected_quote_id"]
isOneToOne: false
      referencedRelation: "shipping_quotes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"id": string,"order_id": string,"provider": string,"provider_payment_id": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"id"?: string,"order_id": string,"provider": string,"provider_payment_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"provider"?: string,"provider_payment_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "int_value": number,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "int_value": number,"key": string
                  }
                  Update: {
                    "int_value"?: number,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"print_prices": {
                  Row: {
                    "low_usd_cents": number | null,"market_usd_cents": number | null,"print_id": string,"sub_type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "low_usd_cents"?: number | null,"market_usd_cents"?: number | null,"print_id": string,"sub_type": string,"updated_at"?: string
                  }
                  Update: {
                    "low_usd_cents"?: number | null,"market_usd_cents"?: number | null,"print_id"?: string,"sub_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "print_prices_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "card_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "print_prices_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "catalog_prints"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "created_at": string,"id": string,"updated_at": string,"whatsapp_number": string | null,"whatsapp_visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"updated_at"?: string,"whatsapp_number"?: string | null,"whatsapp_visible"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"updated_at"?: string,"whatsapp_number"?: string | null,"whatsapp_visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"banned_at": string | null,"bio": string | null,"city": string | null,"created_at": string,"display_name": string | null,"id": string,"phone_verified": boolean,"rating_avg": number,"rating_count": number,"role": Database["public"]['Enums']["user_role"],"state": string | null,"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"banned_at"?: string | null,"bio"?: string | null,"city"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"phone_verified"?: boolean,"rating_avg"?: number,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string,"username": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"banned_at"?: string | null,"bio"?: string | null,"city"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"phone_verified"?: boolean,"rating_avg"?: number,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ratings": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"order_id": string,"ratee_id": string,"rater_id": string,"stars": number
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"order_id": string,"ratee_id": string,"rater_id": string,"stars": number
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"order_id"?: string,"ratee_id"?: string,"rater_id"?: string,"stars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ratings_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_ratee_id_fkey"
      columns: ["ratee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_rater_id_fkey"
      columns: ["rater_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": string,"reporter_id": string,"resolution": string | null,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string,"target_id": string,"target_label": string,"target_owner_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reporter_id": string,"resolution"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id": string,"target_label": string,"target_owner_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id"?: string,"target_label"?: string,"target_owner_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_owner_id_fkey"
      columns: ["target_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"scan_usage": {
                  Row: {
                    "cards_corrected": number,"cards_detected": number,"day": string,"pages": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cards_corrected"?: number,"cards_detected"?: number,"day"?: string,"pages"?: number,"user_id": string
                  }
                  Update: {
                    "cards_corrected"?: number,"cards_detected"?: number,"day"?: string,"pages"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scan_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shipment_events": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"occurred_at": string,"shipment_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"occurred_at": string,"shipment_id": string,"status": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"occurred_at"?: string,"shipment_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipment_events_shipment_id_fkey"
      columns: ["shipment_id"]
isOneToOne: false
      referencedRelation: "shipments"
      referencedColumns: ["id"]
    }
                  ]
                },"shipments": {
                  Row: {
                    "carrier": string,"created_at": string,"id": string,"label_url": string | null,"order_id": string,"provider": string,"provider_shipment_id": string | null,"service": string,"status": string,"tracking_number": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carrier": string,"created_at"?: string,"id"?: string,"label_url"?: string | null,"order_id": string,"provider": string,"provider_shipment_id"?: string | null,"service": string,"status"?: string,"tracking_number": string,"updated_at"?: string
                  }
                  Update: {
                    "carrier"?: string,"created_at"?: string,"id"?: string,"label_url"?: string | null,"order_id"?: string,"provider"?: string,"provider_shipment_id"?: string | null,"service"?: string,"status"?: string,"tracking_number"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"shipping_quotes": {
                  Row: {
                    "carrier": string,"created_at": string,"estimated_days": number | null,"expires_at": string,"id": string,"order_id": string,"price_cents": number,"provider": string,"provider_rate_id": string,"service": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carrier": string,"created_at"?: string,"estimated_days"?: number | null,"expires_at": string,"id"?: string,"order_id": string,"price_cents": number,"provider": string,"provider_rate_id": string,"service": string
                  }
                  Update: {
                    "carrier"?: string,"created_at"?: string,"estimated_days"?: number | null,"expires_at"?: string,"id"?: string,"order_id"?: string,"price_cents"?: number,"provider"?: string,"provider_rate_id"?: string,"service"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipping_quotes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_reveals": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"target_id": string,"viewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"target_id": string,"viewer_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"target_id"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_reveals_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_reveals_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_reveals_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"id": string,"max_price_cents": number | null,"print_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"max_price_cents"?: number | null,"print_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"max_price_cents"?: number | null,"print_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "card_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "catalog_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "card_facets": {
                  Row: {
                    "facet": string | null,"value": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"catalog_prints": {
                  Row: {
                    "attribute": string | null,"card_id": string | null,"card_type": string | null,"code": string | null,"color": string | null,"color2": string | null,"digi_types": (string)[] | null,"dp": number | null,"evolution_cost": number | null,"form": string | null,"game_id": string | null,"id": string | null,"image_path": string | null,"is_default": boolean | null,"is_listed": boolean | null,"level": number | null,"main_effect": string | null,"name": string | null,"play_cost": number | null,"rarity": string | null,"set_ids": (string)[] | null,"slug": string | null,"source_effect": string | null,"stage": string | null,"tcgplayer_product_id": number | null,"variant_label": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "card_prints_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_prints_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_search": {
                  Row: {
                    "accepts_offers": boolean | null,"card_types": (string)[] | null,"colors": (string)[] | null,"conditions": (string)[] | null,"cover_image_path": string | null,"featured_at": string | null,"finishes": (string)[] | null,"id": string | null,"kind": Database["public"]['Enums']["listing_kind"] | null,"languages": (string)[] | null,"price_cents": number | null,"published_at": string | null,"rarities": (string)[] | null,"sealed_type": string | null,"search_text": string | null,"seller_id": string | null,"set_ids": (string)[] | null,"title": string | null,"total_copies": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"print_listing_stats": {
                  Row: {
                    "min_price_cents": number | null,"print_id": string | null,"seller_count": number | null,"total_copies": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "listing_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "card_prints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_items_print_id_fkey"
      columns: ["print_id"]
isOneToOne: false
      referencedRelation: "catalog_prints"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_collection_stats": {
                  Row: {
                    "listing_count": number | null,"seller_id": string | null,"total_copies": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_conversation_items":
{ Args: { "p_conversation_id": string,"p_listing_ids": (string)[] }; Returns: undefined
                           },
"add_conversation_items_internal":
{ Args: { "p_added_by": string,"p_conversation_id": string,"p_listing_ids": (string)[],"p_seller_id": string }; Returns: number
                           },
"can_publish":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"conversation_has_pending_order":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"create_listings_from_scan":
{ Args: { "p_items": Json }; Returns: string[]
                           },
"create_order":
{ Args: { "p_conversation_id": string,"p_item_price_cents": number,"p_origin_address_id": string,"p_package_preset": string }; Returns: string
                           },
"is_in_good_standing":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"make_offer":
{ Args: { "p_amount_cents": number,"p_conversation_id": string,"p_item_id"?: string,"p_scope": string }; Returns: string
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"merge_card_prints":
{ Args: { "p_stale": string,"p_target": string }; Returns: undefined
                           },
"orphaned_listing_photo_paths":
{ Args: { "p_older_than"?: string }; Returns: string[]
                           },
"record_scan_page":
{ Args: { "p_cards": number,"p_max_pages": number,"p_user_id": string }; Returns: boolean
                           },
"record_scan_stats":
{ Args: { "p_corrected": number,"p_detected": number,"p_user_id": string }; Returns: undefined
                           },
"refresh_conversation_title":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"remove_conversation_item":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"replace_listing_items":
{ Args: { "p_items": Json,"p_listing_id": string }; Returns: undefined
                           },
"reset_conversation_pricing":
{ Args: { "p_conversation_id": string,"p_item_id": string }; Returns: undefined
                           },
"resolve_report":
{ Args: { "p_action": string,"p_note": string,"p_report_id": string }; Returns: undefined
                           },
"respond_to_offer":
{ Args: { "p_action": string,"p_message_id": string }; Returns: undefined
                           },
"reveal_whatsapp":
{ Args: { "p_conversation_id": string }; Returns: string
                           },
"select_order_quote":
{ Args: { "p_order_id": string,"p_quote_id": string }; Returns: undefined
                           },
"set_conversation_item_quantity":
{ Args: { "p_item_id": string,"p_quantity": number }; Returns: undefined
                           },
"set_listing_featured":
{ Args: { "p_featured": boolean,"p_listing_id": string }; Returns: undefined
                           },
"set_order_destination":
{ Args: { "p_address_id": string,"p_order_id": string }; Returns: undefined
                           },
"start_conversation":
{ Args: { "p_listing_ids": (string)[] }; Returns: string
                           },
"submit_rating":
{ Args: { "p_comment": string,"p_order_id": string,"p_stars": number }; Returns: string
                           },
"submit_report":
{ Args: { "p_details": string,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: string
                           },
"unban_user":
{ Args: { "p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "listing_kind": "single"|"lot"|"sealed","listing_status": "draft"|"active"|"paused"|"sold"|"removed","order_status": "awaiting_buyer"|"awaiting_payment"|"paid"|"label_ready"|"in_transit"|"delivered"|"label_failed"|"cancelled","user_role": "user"|"moderator"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "listing_kind": ["single", "lot", "sealed"],"listing_status": ["draft", "active", "paused", "sold", "removed"],"order_status": ["awaiting_buyer", "awaiting_payment", "paid", "label_ready", "in_transit", "delivered", "label_failed", "cancelled"],"user_role": ["user", "moderator", "admin"]
          }
        }
} as const
