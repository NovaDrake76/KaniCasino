export interface BannerProps {
    left: {
        image: string;
        title: string;
        description: React.ReactNode;
        // a full url opens in a new tab; a path is a route
        link: string;
        // the button's own words, for a slide whose action is not "go to page"
        cta?: React.ReactNode;
    };

    right: React.ReactNode;
}