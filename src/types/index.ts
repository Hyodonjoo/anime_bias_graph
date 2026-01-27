export interface Theme {
    id: string;
    title: string;
    is_active: boolean;
    created_at?: string;
}

export interface AnimeCard {
    id: string;
    theme_id: string;
    title: string;
    release_year: number;
    image_url: string;
    created_at?: string;
}
