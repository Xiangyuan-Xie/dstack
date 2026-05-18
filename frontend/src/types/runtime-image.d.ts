declare interface IRuntimeImage {
    name: string;
    image: string;
}

declare type TRuntimeImagesUpdateParams = {
    images: IRuntimeImage[];
};
