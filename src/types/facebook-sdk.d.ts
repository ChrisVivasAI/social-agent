declare module 'facebook-nodejs-business-sdk' {
  export class FacebookAdsApi {
    static init(accessToken: string): void;
  }

  export class Page {
    constructor(pageId: string);
    createFeed(fields: any[], data: any): Promise<{ id: string }>;
    createPhoto(fields: any[], data: any): Promise<{ id: string }>;
    read(fields: string[]): Promise<any>;
  }

  export interface PageData {
    id: string;
    name: string;
    fan_count?: number;
    about?: string;
  }

  export interface PostData {
    id: string;
    message?: string;
    created_time?: string;
    likes?: {
      summary: {
        total_count: number;
      };
    };
    comments?: {
      summary: {
        total_count: number;
      };
    };
  }
} 