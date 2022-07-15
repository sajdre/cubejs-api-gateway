import { BackgroundMemoizeOptions } from '@cubejs-backend/shared';
import { JWTOptions } from './interfaces';
export declare type JWKsFetcherOptions = Pick<BackgroundMemoizeOptions<any, any>, 'onBackgroundException'>;
export declare const createJWKsFetcher: (jwtOptions: JWTOptions, options: JWKsFetcherOptions) => {
    fetchOnly: (url: string) => Promise<{
        doneDate: number;
        lifeTime: number;
        result: Map<string, string>;
    }>;
    /**
     * Fetch JWK from cache or load it from jwkUrl
     */
    getJWKbyKid: (url: string, kid: string) => Promise<string | null>;
    release: (waitExecution?: boolean | undefined) => Promise<void>;
};
export declare type JWKSFetcher = ReturnType<typeof createJWKsFetcher>;
//# sourceMappingURL=jwk.d.ts.map