const handleMatch = async (links: string[]) => {
    setScreen("loading"); // 로딩 애니메이션 시작
    
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ links }),
      });

      const data = await response.json().catch(() => ({ success: false, error: "서버가 올바른 응답을 주지 못했습니다." }));
      
      // 통신과 비즈니스 로직이 둘 다 완전 성공했을 때만 결과 페이지로 보냄
      if (response.ok && data.success) {
        if (data.places.length === 0) {
          alert("분석 완료! 아쉽지만 두 분의 리스트 중 겹치는 공통 장소가 하나도 없습니다. 🥲");
          setScreen("input"); // 결과가 없으므로 다시 입력창으로 백
        } else {
          setResults(data.places);
          setScreen("result"); // 진짜 장소가 있을 때만 짜잔! 결과 오픈
        }
      } else {
        // 서버가 에러 사유를 보내준 경우 (주소 파싱 실패 등)
        alert(data.error || "링크 주소를 분석하는 데 실패했습니다.");
        setScreen("input");
      }
    } catch (error) {
      console.error("Error matching places:", error);
      alert("네이버 지도 연결 세션이 불안정합니다. 잠시 후 다시 시도해주세요.");
      setScreen("input"); // 에러 났으니 다시 입력창으로 홀드
    }
  };