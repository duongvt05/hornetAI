"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  History,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Thermometer,
  Droplets,
  Calendar,
  Loader2,
  Bug,
  Volume2,
  MapPin,
  Sparkles,
  RefreshCw,
  Film,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectionEntry {
  species: string;
  commonName: string;
  confidence: number;
  risk: "HIGH" | "MEDIUM" | "LOW";
  severity: "critical" | "warning" | "info";
  description: string;
  solution: string;
  actionTaken: string;
  frameIndex?: number;
}

interface DetectionEvent {
  id: string;
  timestamp: string;
  source: "image" | "video";
  filename: string;
  framesProcessed?: number;
  count: number;
  overallSeverity: "critical" | "warning" | "info";
  dominantSpecies: string | null;
  detections: DetectionEntry[];
  cameraId: string;
  cameraName: string;
  location: string;
  thumbnail: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000";

// Static IoT trend data (in a real system this would come from sensor API)
const TREND_DATA = [
  { time: "08:00", Hornets: 2, Honeybees: 15, "Temperature (°C)": 27.2 },
  { time: "09:00", Hornets: 3, Honeybees: 18, "Temperature (°C)": 28.5 },
  { time: "10:00", Hornets: 5, Honeybees: 22, "Temperature (°C)": 29.8 },
  { time: "11:00", Hornets: 8, Honeybees: 25, "Temperature (°C)": 31.2 },
  { time: "12:00", Hornets: 12, Honeybees: 14, "Temperature (°C)": 32.4 },
  { time: "13:00", Hornets: 14, Honeybees: 8, "Temperature (°C)": 33.5 },
  { time: "14:00", Hornets: 15, Honeybees: 6, "Temperature (°C)": 33.8 },
  { time: "15:00", Hornets: 11, Honeybees: 9, "Temperature (°C)": 34.0 },
  { time: "16:00", Hornets: 7, Honeybees: 15, "Temperature (°C)": 34.2 },
  { time: "17:00", Hornets: 4, Honeybees: 19, "Temperature (°C)": 32.0 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSeverityBadge(severity: "critical" | "warning" | "info") {
  switch (severity) {
    case "critical":
      return (
        <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 flex gap-1 items-center w-fit">
          <AlertCircle className="w-3.5 h-3.5" />
          Critical Danger
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 flex gap-1 items-center w-fit">
          <AlertTriangle className="w-3.5 h-3.5" />
          Warning Alert
        </Badge>
      );
    case "info":
      return (
        <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 flex gap-1 items-center w-fit">
          <CheckCircle className="w-3.5 h-3.5" />
          Safe
        </Badge>
      );
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DetectionHistoryPage() {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [filtered, setFiltered] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedCamera, setSelectedCamera] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<DetectionEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data: DetectionEvent[] = await res.json();
      setEvents(data);
      setFiltered(data);
    } catch (err) {
      toast({
        title: "Data Load Error",
        description: "Could not retrieve detection history from backend.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Filter logic ─────────────────────────────────────────────────────────

  useEffect(() => {
    let result = events;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.cameraName.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.dominantSpecies?.toLowerCase().includes(q) ||
          e.detections.some(
            (d) =>
              d.species.toLowerCase().includes(q) ||
              d.commonName.toLowerCase().includes(q)
          )
      );
    }

    if (selectedSpecies !== "all") {
      result = result.filter((e) =>
        e.detections.some((d) => d.species === selectedSpecies)
      );
    }

    if (selectedSeverity !== "all") {
      result = result.filter((e) => e.overallSeverity === selectedSeverity);
    }

    if (selectedCamera !== "all") {
      result = result.filter((e) => e.cameraId === selectedCamera);
    }

    setFiltered(result);
  }, [searchQuery, selectedSpecies, selectedSeverity, selectedCamera, events]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const allDetections = events.flatMap((e) => e.detections);
  const criticalCount = events.filter(
    (e) => e.overallSeverity === "critical"
  ).length;
  const velutinaCnt = allDetections.filter(
    (d) => d.species === "Vespa_velutina"
  ).length;

  const cameras = Array.from(
    new Map(events.map((e) => [e.cameraId, e.cameraName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const speciesData = [
    {
      name: "V. velutina",
      Sightings: allDetections.filter((d) => d.species === "Vespa_velutina").length,
    },
    {
      name: "V. crabro",
      Sightings: allDetections.filter((d) => d.species === "Vespa_crabro").length,
    },
    {
      name: "Vespula sp.",
      Sightings: allDetections.filter((d) => d.species === "Vespula_sp").length,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center h-[calc(100vh-12rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Loading detection logs…
          </h3>
          <p className="text-muted-foreground">
            Retrieving data from backend API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            Detection History
          </h1>
          <p className="text-muted-foreground mt-1">
            Historical log of all hornet detection events from the AI backend.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/50 backdrop-blur border-border/40 hover:border-primary/20 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total Events
              </span>
              <Bug className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">{events.length}</span>
              <span className="text-xs text-green-500 font-medium">Events</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From AI detection backend
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/40 hover:border-red-500/20 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Critical Events
              </span>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-500">
                {criticalCount}
              </span>
              <span className="text-xs text-red-500 font-medium">
                Critical Alerts
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Require immediate action
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/40 hover:border-primary/20 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                V. velutina Detected
              </span>
              <Thermometer className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">{velutinaCnt}</span>
              <span className="text-xs text-amber-500 font-medium">
                Individuals
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Invasive Asian Hornets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/40 hover:border-primary/20 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total Detections
              </span>
              <Droplets className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">{allDetections.length}</span>
              <span className="text-xs text-blue-500 font-medium">
                Specimens
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card/30 border-border/40">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by camera, species, or location…"
              className="pl-9 bg-background/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter:</span>
            </div>

            <select
              className="bg-background/50 border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-w-[160px]"
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
            >
              <option value="all">All Species</option>
              <option value="Vespa_velutina">Vespa velutina (Asian)</option>
              <option value="Vespa_crabro">Vespa crabro (European)</option>
              <option value="Vespula_sp">Vespula sp. (Common Wasp)</option>
            </select>

            <select
              className="bg-background/50 border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-w-[140px]"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="all">Severity Levels</option>
              <option value="critical">Critical Danger</option>
              <option value="warning">Warning</option>
              <option value="info">Safe</option>
            </select>

            <select
              className="bg-background/50 border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary min-w-[150px]"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
            >
              <option value="all">All Stations</option>
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Main grid: list + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection list */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/50 backdrop-blur border-border/40 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold flex justify-between items-center">
                <span>Detection Event Log</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Showing {filtered.length} events
                </span>
              </CardTitle>
              <CardDescription>
                Each row represents one image or video upload processed by the
                YOLOv8 backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Bug className="h-12 w-12 mx-auto mb-2 text-muted-foreground/55 animate-bounce" />
                  <p className="text-lg font-medium">No events found</p>
                  <p className="text-sm text-muted-foreground/80 mt-1">
                    Upload images or videos on the Live Detection page to
                    generate data.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((event) => {
                    const dominant = event.detections.find(
                      (d) => d.species === event.dominantSpecies
                    );
                    return (
                      <div
                        key={event.id}
                        className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedEvent(event);
                          setDetailOpen(true);
                        }}
                      >
                        {/* Icon + info */}
                        <div className="flex gap-4 items-start sm:items-center w-full sm:w-auto">
                          <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border/60 flex items-center justify-center">
                            {event.thumbnail ? (
                              <img
                                src={`${API_BASE}${event.thumbnail}`}
                                alt={event.dominantSpecies ?? "detection"}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                  (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute("hidden");
                                }}
                              />
                            ) : null}
                            <span hidden={!!event.thumbnail} className="flex items-center justify-center w-full h-full">
                              {event.source === "image" ? (
                                <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                              ) : (
                                <Film className="w-7 h-7 text-muted-foreground/40" />
                              )}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">
                                {dominant?.commonName ?? "No Detection"}
                              </span>
                              {dominant && (
                                <span className="text-xs font-mono text-muted-foreground">
                                  ({dominant.species})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-primary/70" />
                                {event.cameraName}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(event.timestamp).toLocaleString(
                                  "en-US"
                                )}
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground/80 italic">
                              {event.count} detection(s) · {event.source}
                            </div>
                          </div>
                        </div>

                        {/* Severity + confidence */}
                        <div className="flex sm:flex-col items-end justify-between sm:justify-center w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                          {getSeverityBadge(event.overallSeverity)}

                          {dominant && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-primary font-semibold">
                                {dominant.confidence}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Species Activity Density
              </CardTitle>
              <CardDescription>
                Detections by species across all events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speciesData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      strokeOpacity={0.1}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                      cursor={{ fill: "transparent" }}
                    />
                    <Bar
                      dataKey="Sightings"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-amber-500" />
                IoT Climate Correlation
              </CardTitle>
              <CardDescription>
                Ambient temperature vs. hornet flight activity (IoT sensor
                data).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TREND_DATA}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWasp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      strokeOpacity={0.1}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Temperature (°C)"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#colorTemp)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Hornets"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorWasp)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Hornet activity surges when temperature exceeds 31°C.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {selectedEvent && (
          <DialogContent className="max-w-2xl bg-card border border-border/40 shadow-xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                Detection Event
                <Badge variant="outline" className="font-mono text-xs text-primary">
                  {selectedEvent.source}
                </Badge>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4 text-primary" />
                {selectedEvent.cameraName} ·{" "}
                {new Date(selectedEvent.timestamp).toLocaleString("en-US")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Thumbnail */}
              {selectedEvent.thumbnail && (
                <div className="rounded-lg overflow-hidden border border-border/40 bg-muted max-h-64 flex items-center justify-center">
                  <img
                    src={`${API_BASE}${selectedEvent.thumbnail}`}
                    alt={selectedEvent.dominantSpecies ?? "detection"}
                    className="w-full max-h-64 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Overall status */}
              <div className="flex items-center gap-3">
                {getSeverityBadge(selectedEvent.overallSeverity)}
                <span className="text-sm text-muted-foreground">
                  {selectedEvent.count} detection(s)
                  {selectedEvent.framesProcessed !== undefined &&
                    ` · ${selectedEvent.framesProcessed} frames analysed`}
                </span>
              </div>

              {/* Individual detections */}
              <div className="space-y-3">
                {selectedEvent.detections.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-semibold">{d.commonName}</span>
                        <span className="ml-2 text-xs font-mono text-muted-foreground">
                          ({d.species})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(d.severity)}
                        <Badge variant="outline" className="font-mono text-xs">
                          {d.confidence}%
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {d.description}
                    </p>

                    <p className="text-xs text-primary flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      {d.actionTaken}
                    </p>

                    <div className="rounded bg-red-500/5 border border-red-500/10 p-2">
                      <p className="text-xs font-medium text-red-500 mb-0.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Recommended Action:
                      </p>
                      <p className="text-xs text-muted-foreground">{d.solution}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setDetailOpen(false)}
                  variant="secondary"
                  className="px-6"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}