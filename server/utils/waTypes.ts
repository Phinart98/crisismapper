export interface WaTextMessage {
  type: 'text'
  from: string
  id: string
  timestamp: string
  text: { body: string }
}

export interface WaImageMessage {
  type: 'image'
  from: string
  id: string
  timestamp: string
  image: { id: string; mime_type?: string; sha256?: string; caption?: string }
}

export interface WaLocationMessage {
  type: 'location'
  from: string
  id: string
  timestamp: string
  location: { latitude: number; longitude: number; name?: string; address?: string }
}

export interface WaInteractiveMessage {
  type: 'interactive'
  from: string
  id: string
  timestamp: string
  interactive: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

export interface WaUnknownMessage {
  type: string
  from: string
  id: string
  timestamp: string
}

export type WaInboundMessage =
  | WaTextMessage
  | WaImageMessage
  | WaLocationMessage
  | WaInteractiveMessage
  | WaUnknownMessage

export interface WaStatusEvent {
  id?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: string
  recipient_id?: string
  errors?: Array<{ code: number; title: string; message?: string }>
}

export interface WaWebhookPayload {
  object: string
  entry?: Array<{
    id: string
    changes?: Array<{
      field: string
      value: {
        messaging_product?: 'whatsapp'
        metadata?: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile?: { name?: string }; wa_id: string }>
        messages?: WaInboundMessage[]
        statuses?: WaStatusEvent[]
      }
    }>
  }>
}
