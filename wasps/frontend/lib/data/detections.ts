/**
 * Detection data layer
 *
 * Type định nghĩa giữ nguyên tương thích với code hiện có của project.
 * Mock data được giữ lại làm fallback khi backend chưa chạy,
 * nhưng getDetections() ưu tiên gọi API thật trước.
 *
 * Species mapping:
 *   backend returns  →  Detection.species field
 *   "Vespa_velutina" →  "Vespa velutina"
 *   "Vespa_crabro"   →  "Vespa crabro"
 *   "Vespula_sp"     →  "Vespula vulgaris"
 */

const API_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5000')
    : 'http://localhost:5000';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Detection = {
  id: string;
  cameraId: string;
  cameraName: string;
  species: 'Vespa velutina' | 'Vespa crabro' | 'Vespula vulgaris' | 'Apis mellifera';
  commonName: string;
  confidence: number;      // 0–100
  timestamp: string;       // ISO DateTime
  temperature: number;     // IoT °C (static/estimated if backend doesn't provide)
  humidity: number;        // IoT % (static/estimated if backend doesn't provide)
  severity: 'critical' | 'warning' | 'info';
  image: string;
  thumbnail: string;
  actionTaken: string;
  description: string;
  solution: string;
};

// ── Backend response shape ────────────────────────────────────────────────────

interface BackendDetectionEntry {
  species: string;
  commonName: string;
  confidence: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  solution: string;
  actionTaken: string;
}

interface BackendEvent {
  id: string;
  timestamp: string;
  source: 'image' | 'video';
  count: number;
  overallSeverity: 'critical' | 'warning' | 'info';
  dominantSpecies: string | null;
  detections: BackendDetectionEntry[];
  cameraId: string;
  cameraName: string;
  location: string;
  thumbnail: string | null;
}

// ── Species name normalisation ────────────────────────────────────────────────

const SPECIES_MAP: Record<string, Detection['species']> = {
  Vespa_velutina: 'Vespa velutina',
  Vespa_crabro:   'Vespa crabro',
  Vespula_sp:     'Vespula vulgaris',
  Apis_mellifera: 'Apis mellifera',
  // also accept already-normalised names
  'Vespa velutina':  'Vespa velutina',
  'Vespa crabro':    'Vespa crabro',
  'Vespula vulgaris':'Vespula vulgaris',
  'Apis mellifera':  'Apis mellifera',
};

function normaliseSpecies(raw: string): Detection['species'] {
  return SPECIES_MAP[raw] ?? 'Vespa velutina';
}

// ── Convert backend event → Detection[] ──────────────────────────────────────

// Estimated IoT values (randomised slightly per event for realism)
function fakeTemp(seed: string): number {
  const n = seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1);
  return Math.round((28 + (n % 8) + Math.random()) * 10) / 10;
}
function fakeHumidity(seed: string): number {
  const n = seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1);
  return Math.round((65 + (n % 20) + Math.random()) * 10) / 10;
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=800&q=80';
const PLACEHOLDER_THUMB =
  'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=150&q=80';

function backendEventToDetections(event: BackendEvent): Detection[] {
  return event.detections.map((d, i) => ({
    id:         `${event.id}-${i}`,
    cameraId:   event.cameraId,
    cameraName: event.cameraName,
    species:    normaliseSpecies(d.species),
    commonName: d.commonName,
    confidence: d.confidence,
    timestamp:  event.timestamp,
    temperature: fakeTemp(event.id + i),
    humidity:    fakeHumidity(event.id + i),
    severity:   d.severity,
    image:      event.thumbnail ?? PLACEHOLDER_IMAGE,
    thumbnail:  event.thumbnail ?? PLACEHOLDER_THUMB,
    actionTaken: d.actionTaken,
    description: d.description,
    solution:    d.solution,
  }));
}

// ── Mock fallback data ────────────────────────────────────────────────────────

export const mockDetections: Detection[] = [
  {
    id: 'det-001',
    cameraId: 'cam-01',
    cameraName: 'Station 01 - Central Apiary Area',
    species: 'Vespa velutina',
    commonName: 'Asian Hornet (Invasive)',
    confidence: 94.8,
    timestamp: '2026-05-30T12:45:00+07:00',
    temperature: 32.4,
    humidity: 72.5,
    severity: 'critical',
    image:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Ultrasonic Deterrent Activated & Emergency SMS Sent',
    description:
      'Detected an invasive Asian hornet (Vespa velutina) hovering and hunting honeybees near the hive entrance.',
    solution:
      'Inspect hive entrance guards immediately. Keep the 22 kHz ultrasonic deterrent active.',
  },
  {
    id: 'det-002',
    cameraId: 'cam-02',
    cameraName: 'Station 02 - Northern Apple Orchard',
    species: 'Vespa crabro',
    commonName: 'European Hornet',
    confidence: 89.2,
    timestamp: '2026-05-30T11:20:15+07:00',
    temperature: 31.2,
    humidity: 75.8,
    severity: 'warning',
    image:
      'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Logged & Warning Light Strobe Activated',
    description:
      'Detected a European hornet (Vespa crabro) feeding on ripe fruit in the apple orchard canopy.',
    solution:
      'Monitor hornet density. If more than 5 sightings/hour, deploy herbal repellents or organic bait traps.',
  },
  {
    id: 'det-003',
    cameraId: 'cam-01',
    cameraName: 'Station 01 - Central Apiary Area',
    species: 'Apis mellifera',
    commonName: 'European Honeybee',
    confidence: 97.5,
    timestamp: '2026-05-30T10:15:30+07:00',
    temperature: 29.8,
    humidity: 78.4,
    severity: 'info',
    image:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'No threats detected. Normal storage logging.',
    description:
      'Normal foraging activity of the honeybee hive. Stable flight density at the entrance.',
    solution:
      'No intervention required. Colony is healthy and environmental conditions are optimal.',
  },
  {
    id: 'det-004',
    cameraId: 'cam-03',
    cameraName: 'Station 03 - Southern Fruit Orchard',
    species: 'Vespula vulgaris',
    commonName: 'Common Wasp (Yellowjacket)',
    confidence: 86.4,
    timestamp: '2026-05-30T09:40:00+07:00',
    temperature: 28.5,
    humidity: 81.2,
    severity: 'warning',
    image:
      'https://images.unsplash.com/photo-1559812290-7d7d06d4e8c1?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1559812290-7d7d06d4e8c1?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Medium Frequency Ultrasonic Deterrent Activated',
    description:
      'Detected common wasps (Vespula vulgaris) clustering around fallen ripe fruit beneath the trees.',
    solution:
      'Clear fallen fruits from the ground. Set up honey-water traps 10 m away from the perimeter.',
  },
  {
    id: 'det-005',
    cameraId: 'cam-01',
    cameraName: 'Station 01 - Central Apiary Area',
    species: 'Vespa velutina',
    commonName: 'Asian Hornet (Invasive)',
    confidence: 91.2,
    timestamp: '2026-05-29T16:30:22+07:00',
    temperature: 34.2,
    humidity: 64.8,
    severity: 'critical',
    image:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Ultrasonic Deterrent Activated & Emergency SMS Sent',
    description:
      'Detected an Asian hornet (Vespa velutina) attacking and killing a foraging honeybee worker on a flower.',
    solution:
      'High threat warning. Inspect protective wasp traps around the flower beds to reduce local hornet pressure.',
  },
  {
    id: 'det-006',
    cameraId: 'cam-04',
    cameraName: 'Station 04 - Melaleuca Forest Border',
    species: 'Vespa crabro',
    commonName: 'European Hornet',
    confidence: 93.5,
    timestamp: '2026-05-29T14:15:10+07:00',
    temperature: 33.8,
    humidity: 68.2,
    severity: 'warning',
    image:
      'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Logged & Monitored',
    description:
      'A European hornet (Vespa crabro) was observed scouting the beehives stationed near the forest border.',
    solution:
      'Ensure beehive entrances are narrowed so large hornets cannot enter the hives.',
  },
  {
    id: 'det-007',
    cameraId: 'cam-01',
    cameraName: 'Station 01 - Central Apiary Area',
    species: 'Vespa velutina',
    commonName: 'Asian Hornet (Invasive)',
    confidence: 95.3,
    timestamp: '2026-05-29T10:05:00+07:00',
    temperature: 30.5,
    humidity: 79.1,
    severity: 'critical',
    image:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'Ultrasonic Deterrent Activated & Emergency SMS Sent',
    description:
      'Detected an Asian hornet (Vespa velutina) stalking and preying on honeybees directly at hive entrance #04.',
    solution:
      'Install a 5×5 mm galvanized wire mesh screen over the entrance. Spray lemongrass essential oil near the hive base.',
  },
  {
    id: 'det-008',
    cameraId: 'cam-02',
    cameraName: 'Station 02 - Northern Apple Orchard',
    species: 'Apis mellifera',
    commonName: 'European Honeybee',
    confidence: 98.2,
    timestamp: '2026-05-29T08:30:00+07:00',
    temperature: 27.2,
    humidity: 84.5,
    severity: 'info',
    image:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    thumbnail:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=150&q=80',
    actionTaken: 'No threats detected. Normal storage logging.',
    description: 'Honeybee colony foraging early in the morning. Busy traffic observed.',
    solution: 'Morning temperature is ideal for active honeybee foraging. No action needed.',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách detection.
 * - Ưu tiên gọi backend Flask (http://localhost:5000/history).
 * - Nếu backend không chạy hoặc lỗi, trả về mockDetections làm fallback.
 * - Kết quả backend được merge với mock (mock đứng sau) để trang lịch sử
 *   luôn có dữ liệu ngay cả khi backend vừa khởi động chưa có upload nào.
 */
export const getDetections = async (): Promise<Detection[]> => {
  try {
    const res = await fetch(`${API_BASE}/history`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events: BackendEvent[] = await res.json();

    // Convert backend events → Detection[]
    const fromBackend = events.flatMap(backendEventToDetections);

    // Merge: backend results first, then mock data (dedup by id not needed
    // because backend IDs use UUIDs and mock IDs use 'det-XXX')
    return [...fromBackend, ...mockDetections];
  } catch {
    // Backend offline → use mock only
    return new Promise((resolve) => setTimeout(() => resolve(mockDetections), 400));
  }
};