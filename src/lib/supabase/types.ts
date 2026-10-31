
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
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"entity": string,"entity_id": string | null,"id": string,"occurred_at": string,"summary": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: string,"occurred_at"?: string,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: string,"occurred_at"?: string,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"admin_notification_reads": {
                  Row: {
                    "id": string,"notification_key": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"notification_key": string,"read_at"?: string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"notification_key"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admin_permissions": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"key": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admin_role_permissions": {
                  Row: {
                    "permission_id": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_id": string,"role_id": string
                  }
                  Update: {
                    "permission_id"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_role_permissions_permission_id_fkey"
      columns: ["permission_id"]
isOneToOne: false
      referencedRelation: "admin_permissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "admin_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_roles": {
                  Row: {
                    "created_at": string,"id": string,"key": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"key": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"key"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admin_users": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"invited_by": string | null,"role_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"role_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"role_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_users_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "admin_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_clicks": {
                  Row: {
                    "campaign_id": string | null,"id": string,"is_bot": boolean,"link_id": string | null,"locale": string | null,"market": string | null,"network_id": string | null,"occurred_at": string,"product_id": string | null,"referrer_path": string | null,"session_id": string | null,"store_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id"?: string | null,"id"?: string,"is_bot"?: boolean,"link_id"?: string | null,"locale"?: string | null,"market"?: string | null,"network_id"?: string | null,"occurred_at"?: string,"product_id"?: string | null,"referrer_path"?: string | null,"session_id"?: string | null,"store_id"?: string | null
                  }
                  Update: {
                    "campaign_id"?: string | null,"id"?: string,"is_bot"?: boolean,"link_id"?: string | null,"locale"?: string | null,"market"?: string | null,"network_id"?: string | null,"occurred_at"?: string,"product_id"?: string | null,"referrer_path"?: string | null,"session_id"?: string | null,"store_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_clicks_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_clicks_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_clicks_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_clicks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_clicks_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_commissions": {
                  Row: {
                    "amount_minor": number,"conversion_id": string | null,"created_at": string,"currency": string,"external_id": string,"id": string,"network_id": string,"reported_at": string,"source": Database["public"]['Enums']["source_kind"],"source_ref": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"conversion_id"?: string | null,"created_at"?: string,"currency": string,"external_id": string,"id"?: string,"network_id": string,"reported_at": string,"source": Database["public"]['Enums']["source_kind"],"source_ref"?: string | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"conversion_id"?: string | null,"created_at"?: string,"currency"?: string,"external_id"?: string,"id"?: string,"network_id"?: string,"reported_at"?: string,"source"?: Database["public"]['Enums']["source_kind"],"source_ref"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_commissions_conversion_id_fkey"
      columns: ["conversion_id"]
isOneToOne: false
      referencedRelation: "affiliate_conversions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_conversions": {
                  Row: {
                    "campaign_id": string | null,"click_id": string | null,"created_at": string,"currency": string | null,"external_id": string,"id": string,"network_id": string,"occurred_at": string,"product_id": string | null,"raw": Json | null,"sale_amount_minor": number | null,"source": Database["public"]['Enums']["source_kind"],"source_ref": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id"?: string | null,"click_id"?: string | null,"created_at"?: string,"currency"?: string | null,"external_id": string,"id"?: string,"network_id": string,"occurred_at": string,"product_id"?: string | null,"raw"?: Json | null,"sale_amount_minor"?: number | null,"source": Database["public"]['Enums']["source_kind"],"source_ref"?: string | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "campaign_id"?: string | null,"click_id"?: string | null,"created_at"?: string,"currency"?: string | null,"external_id"?: string,"id"?: string,"network_id"?: string,"occurred_at"?: string,"product_id"?: string | null,"raw"?: Json | null,"sale_amount_minor"?: number | null,"source"?: Database["public"]['Enums']["source_kind"],"source_ref"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_conversions_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_conversions_click_id_fkey"
      columns: ["click_id"]
isOneToOne: false
      referencedRelation: "affiliate_clicks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_conversions_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_conversions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_links": {
                  Row: {
                    "active": boolean,"affiliate_url": string | null,"created_at": string,"currency": string,"external_id": string | null,"id": string,"market": string,"network_id": string | null,"original_url": string,"previous_evidence": string | null,"previous_price_minor": number | null,"previous_verified": boolean,"price_minor": number | null,"price_source": Database["public"]['Enums']["source_kind"] | null,"price_updated_at": string | null,"product_id": string,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"affiliate_url"?: string | null,"created_at"?: string,"currency": string,"external_id"?: string | null,"id"?: string,"market": string,"network_id"?: string | null,"original_url": string,"previous_evidence"?: string | null,"previous_price_minor"?: number | null,"previous_verified"?: boolean,"price_minor"?: number | null,"price_source"?: Database["public"]['Enums']["source_kind"] | null,"price_updated_at"?: string | null,"product_id": string,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"affiliate_url"?: string | null,"created_at"?: string,"currency"?: string,"external_id"?: string | null,"id"?: string,"market"?: string,"network_id"?: string | null,"original_url"?: string,"previous_evidence"?: string | null,"previous_price_minor"?: number | null,"previous_verified"?: boolean,"price_minor"?: number | null,"price_source"?: Database["public"]['Enums']["source_kind"] | null,"price_updated_at"?: string | null,"product_id"?: string,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_links_market_fkey"
      columns: ["market"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "affiliate_links_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_networks": {
                  Row: {
                    "active": boolean,"adapter": string,"created_at": string,"id": string,"key": string,"name": string,"price_display_policy": string,"settings": NonNullable<Json>,"subid_param": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"adapter": string,"created_at"?: string,"id"?: string,"key": string,"name": string,"price_display_policy"?: string,"settings"?: NonNullable<Json>,"subid_param"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"adapter"?: string,"created_at"?: string,"id"?: string,"key"?: string,"name"?: string,"price_display_policy"?: string,"settings"?: NonNullable<Json>,"subid_param"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events": {
                  Row: {
                    "category_id": string | null,"id": string,"is_bot": boolean,"locale": string | null,"market": string | null,"occurred_at": string,"product_id": string | null,"referrer_path": string | null,"session_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"id"?: string,"is_bot"?: boolean,"locale"?: string | null,"market"?: string | null,"occurred_at"?: string,"product_id"?: string | null,"referrer_path"?: string | null,"session_id"?: string | null,"type": string
                  }
                  Update: {
                    "category_id"?: string | null,"id"?: string,"is_bot"?: boolean,"locale"?: string | null,"market"?: string | null,"occurred_at"?: string,"product_id"?: string | null,"referrer_path"?: string | null,"session_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_events_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"banner_translations": {
                  Row: {
                    "banner_id": string,"created_at": string,"id": string,"locale": string,"subtitle": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banner_id": string,"created_at"?: string,"id"?: string,"locale": string,"subtitle"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "banner_id"?: string,"created_at"?: string,"id"?: string,"locale"?: string,"subtitle"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "banner_translations_banner_id_fkey"
      columns: ["banner_id"]
isOneToOne: false
      referencedRelation: "banners"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "active": boolean,"campaign_id": string | null,"created_at": string,"ends_at": string | null,"id": string,"image_path": string,"link_url": string | null,"mobile_image_path": string | null,"sort_order": number,"starts_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"campaign_id"?: string | null,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"image_path": string,"link_url"?: string | null,"mobile_image_path"?: string | null,"sort_order"?: number,"starts_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"campaign_id"?: string | null,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"image_path"?: string,"link_url"?: string | null,"mobile_image_path"?: string | null,"sort_order"?: number,"starts_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "banners_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"logo_path": string | null,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"browsing_history": {
                  Row: {
                    "id": string,"product_id": string,"user_id": string,"viewed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"product_id": string,"user_id": string,"viewed_at"?: string
                  }
                  Update: {
                    "id"?: string,"product_id"?: string,"user_id"?: string,"viewed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "browsing_history_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_banners": {
                  Row: {
                    "banner_id": string,"campaign_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banner_id": string,"campaign_id": string
                  }
                  Update: {
                    "banner_id"?: string,"campaign_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_banners_banner_id_fkey"
      columns: ["banner_id"]
isOneToOne: false
      referencedRelation: "banners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_banners_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_products": {
                  Row: {
                    "campaign_id": string,"product_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"product_id": string,"sort_order"?: number
                  }
                  Update: {
                    "campaign_id"?: string,"product_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_products_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_translations": {
                  Row: {
                    "campaign_id": string,"created_at": string,"description": string | null,"id": string,"locale": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"locale": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "campaign_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"locale"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_translations_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"id": string,"name": string,"slug": string,"starts_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"id"?: string,"name": string,"slug": string,"starts_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"starts_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"created_at": string,"icon": string,"id": string,"image_path": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"icon"?: string,"id"?: string,"image_path"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"icon"?: string,"id"?: string,"image_path"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"category_translations": {
                  Row: {
                    "category_id": string,"created_at": string,"description": string | null,"id": string,"locale": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"locale": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"locale"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "category_translations_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "body": string,"created_at": string,"email": string,"handled": boolean,"id": string,"locale": string | null,"name": string,"subject": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"email": string,"handled"?: boolean,"id"?: string,"locale"?: string | null,"name": string,"subject"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"email"?: string,"handled"?: boolean,"id"?: string,"locale"?: string | null,"name"?: string,"subject"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_rollups": {
                  Row: {
                    "campaign_id": string | null,"category_id": string | null,"day": string,"id": string,"metric": string,"network_id": string | null,"product_id": string | null,"store_id": string | null,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id"?: string | null,"category_id"?: string | null,"day": string,"id"?: string,"metric": string,"network_id"?: string | null,"product_id"?: string | null,"store_id"?: string | null,"value"?: number
                  }
                  Update: {
                    "campaign_id"?: string | null,"category_id"?: string | null,"day"?: string,"id"?: string,"metric"?: string,"network_id"?: string | null,"product_id"?: string | null,"store_id"?: string | null,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_rollups_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_rollups_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_rollups_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_rollups_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_rollups_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"markets": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"default_currency": string,"name_pt": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"default_currency": string,"name_pt": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"default_currency"?: string,"name_pt"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"network_credentials": {
                  Row: {
                    "ciphertext": string,"created_at": string,"id": string,"iv": string,"last4": string,"network_id": string,"tag": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ciphertext": string,"created_at"?: string,"id"?: string,"iv": string,"last4"?: string,"network_id": string,"tag": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "ciphertext"?: string,"created_at"?: string,"id"?: string,"iv"?: string,"last4"?: string,"network_id"?: string,"tag"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "network_credentials_network_id_fkey"
      columns: ["network_id"]
isOneToOne: true
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    }
                  ]
                },"network_sync_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"id": string,"inserted": number,"kind": string,"network_id": string,"ok": boolean | null,"started_at": string,"updated": number
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"inserted"?: number,"kind"?: string,"network_id": string,"ok"?: boolean | null,"started_at"?: string,"updated"?: number
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"inserted"?: number,"kind"?: string,"network_id"?: string,"ok"?: boolean | null,"started_at"?: string,"updated"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "network_sync_runs_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"created_at": string,"id": string,"is_main": boolean,"path": string,"product_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"is_main"?: boolean,"path": string,"product_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "alt"?: string | null,"created_at"?: string,"id"?: string,"is_main"?: boolean,"path"?: string,"product_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_prices": {
                  Row: {
                    "created_at": string,"currency": string,"id": string,"link_id": string,"observed_at": string,"price_minor": number,"source": Database["public"]['Enums']["source_kind"],"source_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": string,"id"?: string,"link_id": string,"observed_at"?: string,"price_minor": number,"source": Database["public"]['Enums']["source_kind"],"source_ref"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"link_id"?: string,"observed_at"?: string,"price_minor"?: number,"source"?: Database["public"]['Enums']["source_kind"],"source_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_prices_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["id"]
    }
                  ]
                },"product_tags": {
                  Row: {
                    "product_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "product_id": string,"tag_id": string
                  }
                  Update: {
                    "product_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_tags_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"product_translations": {
                  Row: {
                    "created_at": string,"description_md": string | null,"id": string,"locale": string,"name": string,"product_id": string,"short_description": string | null,"specs_i18n": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description_md"?: string | null,"id"?: string,"locale": string,"name": string,"product_id": string,"short_description"?: string | null,"specs_i18n"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description_md"?: string | null,"id"?: string,"locale"?: string,"name"?: string,"product_id"?: string,"short_description"?: string | null,"specs_i18n"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_translations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "brand_id": string | null,"category_id": string,"created_at": string,"external_id": string | null,"featured": boolean,"id": string,"published_at": string | null,"rating": number | null,"rating_count": number | null,"rating_source": string | null,"rating_source_kind": Database["public"]['Enums']["source_kind"] | null,"search_tsv": unknown,"sku": string | null,"slug": string,"specs": NonNullable<Json>,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id"?: string | null,"category_id": string,"created_at"?: string,"external_id"?: string | null,"featured"?: boolean,"id"?: string,"published_at"?: string | null,"rating"?: number | null,"rating_count"?: number | null,"rating_source"?: string | null,"rating_source_kind"?: Database["public"]['Enums']["source_kind"] | null,"search_tsv"?: unknown,"sku"?: string | null,"slug": string,"specs"?: NonNullable<Json>,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string | null,"category_id"?: string,"created_at"?: string,"external_id"?: string | null,"featured"?: boolean,"id"?: string,"published_at"?: string | null,"rating"?: number | null,"rating_count"?: number | null,"rating_source"?: string | null,"rating_source_kind"?: Database["public"]['Enums']["source_kind"] | null,"search_tsv"?: unknown,"sku"?: string | null,"slug"?: string,"specs"?: NonNullable<Json>,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "consent": NonNullable<Json>,"created_at": string,"full_name": string | null,"history_enabled": boolean,"id": string,"preferred_locale": string | null,"preferred_market": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent"?: NonNullable<Json>,"created_at"?: string,"full_name"?: string | null,"history_enabled"?: boolean,"id": string,"preferred_locale"?: string | null,"preferred_market"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "consent"?: NonNullable<Json>,"created_at"?: string,"full_name"?: string | null,"history_enabled"?: boolean,"id"?: string,"preferred_locale"?: string | null,"preferred_market"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "active": boolean,"created_at": string,"ends_at": string,"highlighted": boolean,"id": string,"link_id": string | null,"product_id": string,"publish_at": string | null,"reason": string | null,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"ends_at": string,"highlighted"?: boolean,"id"?: string,"link_id"?: string | null,"product_id": string,"publish_at"?: string | null,"reason"?: string | null,"starts_at": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"ends_at"?: string,"highlighted"?: boolean,"id"?: string,"link_id"?: string | null,"product_id"?: string,"publish_at"?: string | null,"reason"?: string | null,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"searches": {
                  Row: {
                    "id": string,"locale": string | null,"occurred_at": string,"query": string,"results": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"locale"?: string | null,"occurred_at"?: string,"query": string,"results"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"locale"?: string | null,"occurred_at"?: string,"query"?: string,"results"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "created_at": string,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"store_domains": {
                  Row: {
                    "created_at": string,"domain": string,"id": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain": string,"id"?: string,"store_id": string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string,"id"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_domains_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"logo_path": string | null,"markets": (string)[],"name": string,"network_id": string | null,"official_url": string | null,"price_display_policy": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"logo_path"?: string | null,"markets"?: (string)[],"name": string,"network_id"?: string | null,"official_url"?: string | null,"price_display_policy"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"logo_path"?: string | null,"markets"?: (string)[],"name"?: string,"network_id"?: string | null,"official_url"?: string | null,"price_display_policy"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_network_id_fkey"
      columns: ["network_id"]
isOneToOne: false
      referencedRelation: "affiliate_networks"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_save_product":
{ Args: { "p": Json }; Returns: string
                           },
"campaign_is_live":
{ Args: { "c": string }; Returns: boolean
                           },
"f_unaccent":
{ Args: { "": string }; Returns: string
                           },
"has_admin_permission":
{ Args: { "p": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_admin_context":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,"permissions": (string)[],"role_key": string
            }[]
                           },
"offer_display_price":
{ Args: { "p_link": string }; Returns: number
                           },
"offer_proven_previous":
{ Args: { "p_link": string }; Returns: number
                           },
"prefix_tsquery":
{ Args: { "q": string }; Returns: unknown
                           },
"product_is_public":
{ Args: { "p": string }; Returns: boolean
                           },
"product_market_price":
{ Args: { "p_market": string,"p_product": string }; Returns: {
              "currency": string,"discount": number,"link_id": string,"previous_minor": number,"price_minor": number
            }[]
                           },
"product_offers":
{ Args: { "p_ids": (string)[] }; Returns: {
              "currency": string,"history": Json,"id": string,"market": string,"network_adapter": string,"network_id": string,"policy": string,"previous_price_minor": number,"previous_verified": boolean,"price_minor": number,"price_source": Database["public"]['Enums']["source_kind"],"price_updated_at": string,"product_id": string,"requires_fresh": boolean,"store_id": string,"store_logo": string,"store_name": string,"store_slug": string
            }[]
                           },
"product_popularity":
{ Args: { "p_product": string }; Returns: number
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"refresh_product_search":
{ Args: { "p_product": string }; Returns: undefined
                           },
"search_products":
{ Args: { "p_brand"?: string,"p_category"?: string,"p_limit"?: number,"p_locale": string,"p_market": string,"p_max_minor"?: number,"p_min_minor"?: number,"p_min_rating"?: number,"p_offset"?: number,"p_proven_discount"?: boolean,"p_sort"?: string,"p_store"?: string,"q": string }; Returns: {
              "best_price_minor": number,"brand_name": string,"category_id": string,"discount": number,"id": string,"name": string,"popularity": number,"published_at": string,"rank": number,"rating": number,"rating_count": number,"rating_source": string,"slug": string,"total_count": number
            }[]
                           },
"storage_bucket_permission":
{ Args: { "bucket": string }; Returns: string
                           },
"suggest":
{ Args: { "p_limit"?: number,"p_locale": string,"q": string }; Returns: {
              "kind": string,"label": string,"slug": string
            }[]
                           }
          }
          Enums: {
            "source_kind": "manual"|"import"|"integration"
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
            "source_kind": ["manual", "import", "integration"]
          }
        }
} as const
