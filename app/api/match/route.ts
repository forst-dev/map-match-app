import { NextRequest, NextResponse } from 'next/server';

const MOCK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://map.naver.com',
  'Referer': 'https://map.naver.com/'
};

// 1. 단축 URL 해제 함수
async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': MOCK_HEADERS['User-Agent'] },
    });
    
    const location = response.headers.get('location');
    if (location) {
      return location.startsWith('http') ? location : new URL(location, url).href;
    }
    return url;
  } catch (error) {
    return url;
  }
}

// 2. [최신형 마이플레이스] 네이버 마이플레이스 폴더 데이터 긁어오기
async function fetchNaverMyPlaceFolder(folderId: string): Promise<any[]> {
  try {
    // 유저님이 알려주신 새로운 2026년형 마이플레이스 폴더 조회 전용 내부 API
    const apiUrl = `https://map.naver.com/p/api/myplace/folder/${folderId}/places?extDetail=true&lang=ko`;
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    if (!response.ok) {
      console.error(`네이버 API 호출 실패 status: ${response.status} (ID: ${folderId})`);
      return [];
    }

    const data = await response.json();
    // 네이버 마이플레이스 응답 객체 구조 분해 방어막
    const items = data.items || data.places || data.list || [];
    
    return items.map((item: any) => ({
      name: item.name || item.title || item.placeName || '',
      category: item.category || item.displayCategory || '장소',
      address: item.address || item.roadAddress || '',
      naverUrl: `https://map.naver.com/p/entry/place/${item.id || item.placeId}`
    })).filter((item: any) => item.name !== '');
  } catch (e) {
    console.error('최신 마이플레이스 파싱 에러:', e);
    return [];
  }
}

// 3. [구형 마이폴더] 기존 마이폴더 API 호출
async function fetchNaverMyFolderList(folderId: string): Promise<any[]> {
  try {
    const apiUrl = `https://map.naver.com/p/api/favorite/folder/${folderId}?lang=ko`;
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    if (!response.ok) return [];
    const data = await response.json();
    const items = data.favorites || [];
    return items.map((item: any) => ({
      name: item.name || '',
      category: item.category || '장소',
      address: item.address || '',
      naverUrl: `https://map.naver.com/p/entry/place/${item.id}`
    })).filter((item: any) => item.name !== '');
  } catch (e) {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { links } = await req.json();

    if (!links || !Array.isArray(links) || links.length < 2) {
      return NextResponse.json({ error: '최소 2개 이상의 링크를 입력해주세요.' }, { status: 400 });
    }

    // URL 최종 리다이렉트 복원
    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));
    
    // 데이터 로드 수행
    const allListsResults = await Promise.all(resolvedUrls.map(async (url) => {
      // 💡 [2026 핵심 타겟] 유저님이 주신 /myPlace/folder/영어숫자혼합ID 패턴 완벽 대응
      const myPlaceMatch = url.match(/myPlace\/folder\/([A-Za-z0-9]+)/);
      if (myPlaceMatch && myPlaceMatch[1]) {
        return await fetchNaverMyPlaceFolder(myPlaceMatch[1]);
      }

      // 기존 숫자형 마이폴더 패턴 대응
      const myFolderMatch = url.match(/myFolder\/[^\/]+\/([0-9]+)/) || url.match(/favorite\/folder\/([0-9]+)/);
      if (myFolderMatch && myFolderMatch[1]) {
        return await fetchNaverMyFolderList(myFolderMatch[1]);
      }

      return [];
    }));

    // 디버깅용 로그 남기기 (ID가 추출되었는지 확인용)
    resolvedUrls.forEach((url, idx) => {
      console.log(`[디버그] ${idx + 1}번 링크 변환 결과 -> `, url);
    });

    // 하나라도 장소를 못 긁어왔다면 커트
    if (allListsResults.some(list => list.length === 0)) {
      return NextResponse.json({ 
        error: '입력하신 공유 폴더 주소에서 장소 ID를 유추하지 못했거나 빈 폴더입니다. 리스트가 공개 상태인지 다시 한번 확인해 주세요.' 
      }, { status: 400 });
    }

    // 교집합 추출 (공백 제거 후 비교)
    const firstList = allListsResults[0];
    const restLists = allListsResults.slice(1);

    const commonPlaces = firstList.filter(placeA => 
      restLists.every(subList => 
        subList.some((placeB: any) => placeB.name.replace(/\s+/g, '') === placeA.name.replace(/\s+/g, ''))
      )
    );

    // 일치율 계산
    const totalUniqueCount = new Set([...allListsResults.flat()].map(p => p.name)).size;
    const matchRate = totalUniqueCount > 0 ? Math.round((commonPlaces.length / totalUniqueCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      matchRate: matchRate,
      places: commonPlaces
    });

  } catch (error) {
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}