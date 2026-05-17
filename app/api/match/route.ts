import { NextRequest, NextResponse } from 'next/server';

const MOCK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://map.naver.com',
  'Referer': 'https://map.naver.com/'
};

// 1. 단축 URL 해제
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

// 2. [신형] 네이버 마이폴더 API 호출
async function fetchNaverMyFolderList(folderId: string): Promise<any[]> {
  try {
    const apiUrl = `https://map.naver.com/p/api/favorite/folder/${folderId}?lang=ko`;
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    if (!response.ok) return [];

    const data = await response.json();
    const items = data.favorites || [];
    
    return items.map((item: any) => ({
      name: item.name || item.title || '',
      category: item.category || '장소',
      address: item.address || item.roadAddress || '',
      naverUrl: `https://map.naver.com/p/entry/place/${item.id || item.placeId}`
    })).filter((item: any) => item.name !== '');
  } catch (e) {
    console.error('마이폴더 파싱 에러:', e);
    return [];
  }
}

// 3. [구형] 네이버 북마크 API 호출
async function fetchNaverBookmarkList(listId: string): Promise<any[]> {
  try {
    const apiUrl = `https://map.naver.com/v5/api/bookmark/share/${listId}`;
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    if (!response.ok) return [];

    const data = await response.json();
    const items = data.bookmarkList?.transforms || data.bookmarkList?.items || [];
    
    return items.map((item: any) => ({
      name: item.name || item.title || '',
      category: item.displayCategory || item.category || '장소',
      address: item.address || item.roadAddress || '',
      naverUrl: `https://map.naver.com/v5/entry/place/${item.id || item.placeId}`
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

    // URL 복원
    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));
    
    // 데이터 로드 수행
    const allListsResults = await Promise.all(resolvedUrls.map(async (url) => {
      // 💡 [정규식 대공사] 주소창의 유동적인 패턴을 다 잡아내도록 수정
      // 1순위: /myFolder/all/숫자 또는 /myFolder/폴더이름/숫자 포맷
      // 2순위: /favorite/folder/숫자 포맷
      const folderIdMatch = url.match(/myFolder\/[^\/]+\/([0-9]+)/) || 
                            url.match(/favorite\/folder\/([0-9]+)/) ||
                            url.match(/folder\/([0-9]+)/);
                            
      if (folderIdMatch && folderIdMatch[1]) {
        return await fetchNaverMyFolderList(folderIdMatch[1]);
      }

      // 구형 북마크 공유 포맷
      const bookmarkMatch = url.match(/(?:bookmarkListId|shareRoleId)=([A-Za-z0-9_-]+)/) || url.match(/bookmark\/share\/([A-Za-z0-9_-]+)/);
      if (bookmarkMatch && bookmarkMatch[1]) {
        return await fetchNaverBookmarkList(bookmarkMatch[1]);
      }

      return [];
    }));

    // 어떤 링크가 실패했는지 디버깅용 로그 (Vercel 로그에서 확인 가능)
    allListsResults.forEach((list, idx) => {
      if (list.length === 0) {
        console.error(`[MapMatch Error] ${idx + 1}번째 링크 파싱 실패 원본주소:`, resolvedUrls[idx]);
      }
    });

    // 하나라도 장소를 못 긁어왔다면 커트
    if (allListsResults.some(list => list.length === 0)) {
      return NextResponse.json({ 
        error: '입력하신 공유 폴더 주소에서 장소 ID를 유추하지 못했거나 빈 폴더입니다. 올바른 주소인지 확인해 주세요.' 
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