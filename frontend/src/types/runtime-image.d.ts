declare interface IRuntimeImage {
    name: string;
    image: string;
    category?: string | null;
    description?: string | null;
    tags?: string[];
    recommended_env?: Record<string, string>;
}

declare type TRuntimeImagesUpdateParams = {
    images: IRuntimeImage[];
};
