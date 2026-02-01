// Simple global state to hold the item being dragged
// This avoids issues with dataTransfer parsing or availability in some browser contexts
import { AnimeItem } from './mockData';

let draggedItem: AnimeItem | null = null;

export const setDraggedItem = (item: AnimeItem | null) => {
    draggedItem = item;
};

export const getDraggedItem = (): AnimeItem | null => {
    return draggedItem;
};
