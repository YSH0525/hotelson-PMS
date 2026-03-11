-- =============================================
-- 호텔스온 PMS - Supabase 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 호텔 설정
CREATE TABLE IF NOT EXISTS hotel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name TEXT NOT NULL DEFAULT '호텔스온',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  check_in_time TIME DEFAULT '15:00',
  check_out_time TIME DEFAULT '11:00',
  tax_rate NUMERIC DEFAULT 10,
  currency TEXT DEFAULT 'KRW',
  timezone TEXT DEFAULT 'Asia/Seoul',
  notification_settings JSONB DEFAULT '{
    "reservation_new": true,
    "reservation_cancel": true,
    "check_in_reminder": true,
    "check_out_reminder": true,
    "no_show_alert": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 사용자 프로필 (Supabase Auth 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 객실타입
CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  default_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 호실
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'out_of_order')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 예약
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  total_amount INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date)
);

-- 결제
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  channel TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 현금 시재 관리
CREATE TABLE IF NOT EXISTS cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('opening', 'income', 'expense', 'closing')),
  category TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 동적 폼 스키마
CREATE TABLE IF NOT EXISTS form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type_id);
CREATE INDEX IF NOT EXISTS idx_rooms_sort ON rooms(sort_order);
CREATE INDEX IF NOT EXISTS idx_room_types_sort ON room_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_reservations_room_dates ON reservations(room_id, check_in_date, check_out_date)
  WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status, check_in_date);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON cash_ledger(entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_type ON cash_ledger(entry_type, entry_date);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 정책
CREATE POLICY "authenticated_full_access" ON hotel_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON room_types FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON rooms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON reservations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON form_schemas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON cash_ledger FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- updated_at 자동 업데이트 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotel_settings_updated_at
  BEFORE UPDATE ON hotel_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_types_updated_at
  BEFORE UPDATE ON room_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_schemas_updated_at
  BEFORE UPDATE ON form_schemas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_ledger_updated_at
  BEFORE UPDATE ON cash_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 신규 사용자 프로필 자동 생성 트리거
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 기본 데이터
-- =============================================

-- 기본 호텔 설정
INSERT INTO hotel_settings (hotel_name) VALUES ('호텔스온')
ON CONFLICT DO NOTHING;

-- 기본 폼 스키마
INSERT INTO form_schemas (name, is_default, fields) VALUES (
  '기본 예약 양식',
  true,
  '[
    {
      "id": "field_channel",
      "label": "예약 채널",
      "fieldType": "select",
      "required": true,
      "sortOrder": 0,
      "width": "half",
      "options": [
        {"id": "opt_ch_1", "label": "직접 예약", "value": "direct", "sortOrder": 0},
        {"id": "opt_ch_2", "label": "야놀자", "value": "yanolja", "sortOrder": 1},
        {"id": "opt_ch_3", "label": "여기어때", "value": "yeogi", "sortOrder": 2},
        {"id": "opt_ch_4", "label": "Booking.com", "value": "booking", "sortOrder": 3},
        {"id": "opt_ch_5", "label": "Agoda", "value": "agoda", "sortOrder": 4},
        {"id": "opt_ch_6", "label": "네이버", "value": "naver", "sortOrder": 5}
      ]
    },
    {
      "id": "field_payment_type",
      "label": "결제 구분",
      "fieldType": "select",
      "required": true,
      "sortOrder": 1,
      "width": "half",
      "options": [
        {"id": "opt_pay_1", "label": "카드", "value": "card", "sortOrder": 0},
        {"id": "opt_pay_2", "label": "현금", "value": "cash", "sortOrder": 1},
        {"id": "opt_pay_3", "label": "계좌이체", "value": "transfer", "sortOrder": 2},
        {"id": "opt_pay_4", "label": "채널결제", "value": "channel_pay", "sortOrder": 3}
      ]
    },
    {
      "id": "field_adults",
      "label": "성인",
      "fieldType": "number",
      "required": false,
      "sortOrder": 2,
      "width": "third",
      "defaultValue": 2,
      "placeholder": "인원수"
    },
    {
      "id": "field_children",
      "label": "아동",
      "fieldType": "number",
      "required": false,
      "sortOrder": 3,
      "width": "third",
      "defaultValue": 0,
      "placeholder": "인원수"
    },
    {
      "id": "field_special_request",
      "label": "특별 요청사항",
      "fieldType": "textarea",
      "required": false,
      "sortOrder": 4,
      "width": "full",
      "placeholder": "고객 요청사항을 입력하세요"
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- =============================================
-- OTA 연동 관리
-- =============================================

-- OTA 연결 설정
CREATE TABLE IF NOT EXISTS ota_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE,          -- 'yanolja', 'yeogi', 'agoda' 등
  is_enabled BOOLEAN DEFAULT false,      -- 연동 활성화 여부
  partner_url TEXT,                      -- 파트너 사이트 URL
  property_id TEXT,                      -- OTA측 숙소 ID (야놀자: 10044600 등)
  last_sync_at TIMESTAMPTZ,             -- 마지막 동기화 시각
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
  error_message TEXT,                    -- 마지막 에러 메시지
  settings JSONB DEFAULT '{}',           -- OTA별 추가 설정
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OTA 동기화 로그
CREATE TABLE IF NOT EXISTS ota_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES ota_connections(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  sync_date DATE NOT NULL,              -- 동기화 대상 날짜
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'error')),
  reservations_found INTEGER DEFAULT 0, -- 발견된 예약 수
  reservations_created INTEGER DEFAULT 0,-- 신규 생성된 예약 수
  reservations_updated INTEGER DEFAULT 0,-- 업데이트된 예약 수
  reservations_skipped INTEGER DEFAULT 0,-- 중복 스킵된 예약 수
  error_message TEXT,
  raw_data JSONB,                       -- 스크래핑 원본 데이터 (디버깅용)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- OTA 예약 매핑 (OTA 예약번호 ↔ PMS 예약 ID 매핑)
CREATE TABLE IF NOT EXISTS ota_reservation_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  ota_reservation_id TEXT NOT NULL,     -- OTA측 예약번호
  ota_status TEXT,                      -- OTA측 예약 상태
  ota_amount INTEGER DEFAULT 0,         -- OTA측 판매가
  ota_deposit_amount INTEGER DEFAULT 0, -- OTA측 입금예정가
  raw_data JSONB,                       -- OTA 원본 데이터
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, ota_reservation_id)   -- OTA별 예약번호 유니크
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ota_connections_channel ON ota_connections(channel);
CREATE INDEX IF NOT EXISTS idx_ota_sync_logs_connection ON ota_sync_logs(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ota_sync_logs_date ON ota_sync_logs(sync_date, channel);
CREATE INDEX IF NOT EXISTS idx_ota_reservation_map_channel ON ota_reservation_map(channel, ota_reservation_id);
CREATE INDEX IF NOT EXISTS idx_ota_reservation_map_reservation ON ota_reservation_map(reservation_id);

-- RLS
ALTER TABLE ota_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ota_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ota_reservation_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON ota_connections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON ota_sync_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_full_access" ON ota_reservation_map FOR ALL USING (auth.role() = 'authenticated');

-- updated_at 트리거
CREATE TRIGGER update_ota_connections_updated_at
  BEFORE UPDATE ON ota_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Realtime 구독 활성화
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_types;
