export interface BannerProps {
    left: {
        image: string;
        title: string;
        description: string;
        link: string;
    };

    right: React.ReactNode;
}