export interface AnimeItem {
    id: string;
    title: string;
    imageUrl: string;
    year: number;
    tag?: string;
}

export const MOCK_THEME = "2024년 4분기 애니메이션 결산 (2024 Winter Anime)";

export const AXIS_LABELS = {
    x: { negative: "스토리 가벼움", positive: "스토리 무거움" },
    y: { negative: "로맨스 낮음", positive: "로맨스 높음" }
};

export const MOCK_AXIS = {
    top: "스토리 무거움 (Story Heavy)",
    bottom: "스토리 가벼움 (Story Light)",
    left: "로맨스 적음 (Romance Low)",
    right: "로맨스 많음 (Romance High)"
};

export const MOCK_ANIME_LIST: AnimeItem[] = [
    { id: '1', title: 'Frieren: Beyond Journey\'s End', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg' },
    { id: '2', title: 'The Apothecary Diaries', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1708/138033.jpg' },
    { id: '3', title: 'Dungeon Meshi', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1587/140062.jpg' },
    { id: '4', title: 'Mashle: Magic and Muscles', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1206/143525.jpg' },
    { id: '5', title: 'Solo Leveling', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1108/139773.jpg' },
    { id: '6', title: 'Classroom of the Elite III', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1586/140578.jpg' },
    { id: '7', title: 'Boku no Kokoro no Yabai Yatsu 2', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1647/140498.jpg' },
    { id: '8', title: 'Metallic Rouge', year: 2024, imageUrl: 'https://cdn.myanimelist.net/images/anime/1297/140507.jpg' },
];
