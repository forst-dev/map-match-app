"use client";

import { useState } from "react";
import { Plus, X, MapPin, ExternalLink, RefreshCw } from "lucide-react";

type ScreenType = "input" | "loading" | "result";

interface PlaceResult {
  name: string;
  category: string;
  address: string;
  naverUrl: string;
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-muted" />
        <div className="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <MapPin className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-foreground">
          두 분의 리스트를 대조하고 있어요...
        </p>
        <p className="text-sm text-muted-foreground">잠시만 기다려주세요</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function PlaceCard({ place }: { place: PlaceResult }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-lg truncate">
              {place.name}
            </h3>
            <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
              {place.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {place.address}
          </p>
        </div>
        <a
          href={place.naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          <span className="hidden sm:inline">네이버 지도로 보기</span>
          <span className="sm:hidden">지도</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

function ResultScreen({ onReset, results }: { onReset: () => void; results: PlaceResult[] }) {
  return (
    <div className="flex flex-col min-h-[80vh]">
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-balance">
          축하합니다!
        </h2>
        <p className="text-lg sm:text-xl text-foreground">
          두 분의 저장 목록에서 공통 장소를 찾았습니다!
        </p>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h3 className="font-semibold text-foreground">
            공통 저장 장소 {results.length}곳
          </h3>
        </div>
        <div className="space-y-3">
          {results.map((place, index) => (
            <PlaceCard key={index} place={place} />
          ))}
        </div>
      </div>

      <div className="pt-8 pb-4">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-secondary text-secondary-foreground font-semibold rounded-2xl hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          다시 매칭하기
        </button>
      </div>
    </div>
  );
}

function InputScreen({
  onMatch,
}: {
  onMatch: (links: string[]) => void;
}) {
  const [links, setLinks] = useState<string[]>(["", ""]);

  const addLink = () => {
    if (links.length < 5) {
      setLinks([...links, ""]);
    }
  };

  const removeLink = (index: number) => {
    if (links.length > 2) {
      setLinks(links.filter((_, i) => i !== index));
    }
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const handleMatchSubmit = () => {
    const validLinks = links.filter((link) => link.trim() !== "");
    if (validLinks.length >= 2) {
      onMatch(validLinks);
    } else {
      alert("최소 2개 이상의 주소를 입력해주세요!");
    }
  };

  return (
    <div className="flex flex-col min-h-[80vh]">
      <div className="text-center py-8 sm:py-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <MapPin className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          MapMatch
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          맵매치
        </p>
        <p className="text-base sm:text-lg text-muted-foreground mt-4 text-balance">
          친구와 겹치는 저장 장소를 찾아보세요
        </p>
      </div>

      <div className="flex-1 space-y-3">
        {links.map((link, index) => (
          <div key={index} className="relative group">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => updateLink(index, e.target.value)}
                  placeholder="https://naver.me/..."
                  className="w-full px-4 py-4 bg-card border border-border rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm sm:text-base"
                />
                <span className="absolute left-4 -top-2.5 px-1 bg-background text-xs text-muted-foreground">
                  링크 {index + 1}
                </span>
              </div>
              {links.length > 2 && (
                <button
                  onClick={() => removeLink(index)}
                  className="shrink-0 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  aria-label={`링크 ${index + 1} 삭제`}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {links.length < 5 && (
          <button
            onClick={addLink}
            className="w-full py-4 px-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">링크 추가하기</span>
          </button>
        )}
      </div>

      <div className="pt-8 pb-4">
        <button
          onClick={handleMatchSubmit}
          className="w-full py-4 px-6 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-lg"
        >
          공통 장소 찾기
        </button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          네이버 지도 공유 리스트의 링크를 입력해주세요
        </p>
      </div>
    </div>
  );
}

// 💡 [해결 포인트] Next.js 빌더가 인식할 수 있도록 정확한 default export 명시
export default function MapMatchPage() {
  const [screen, setScreen] = useState<ScreenType>("input");
  const [results, setResults] = useState<PlaceResult[]>([]);

  const handleMatch = async (links: string[]) => {
    setScreen("loading");
    
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ links }),
      });

      const data = await response.json().catch(() => ({ success: false, error: "서버가 올바른 응답을 주지 못했습니다." }));
      
      if (response.ok && data.success) {
        if (!data.places || data.places.length === 0) {
          alert("분석 완료! 아쉽지만 두 분의 리스트 중 겹치는 공통 장소가 하나도 없습니다. 🥲");
          setScreen("input");
        } else {
          setResults(data.places);
          setScreen("result");
        }
      } else {
        alert(data.error || "링크 주소를 분석하는 데 실패했습니다.");
        setScreen("input");
      }
    } catch (error) {
      console.error("Error matching places:", error);
      alert("네이버 지도 연결 세션이 불안정합니다. 잠시 후 다시 시도해주세요.");
      setScreen("input");
    }
  };

  const handleReset = () => {
    setScreen("input");
    setResults([]);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-5 py-6">
        {screen === "input" && <InputScreen onMatch={handleMatch} />}
        {screen === "loading" && <LoadingSpinner />}
        {screen === "result" && <ResultScreen onReset={handleReset} results={results} />}
      </div>
    </main>
  );
}