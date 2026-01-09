export interface GeoLocation {
    latitude: number;
    longitude: number;
}

export interface GeolocationResult {
    success: boolean;
    location?: GeoLocation;
    error?: string;
}

class GeolocationService {
    /**
     * Get current GPS position
     * @param timeout Timeout in milliseconds (default: 10000)
     * @returns Promise with location or error
     */
    async getCurrentPosition(timeout: number = 10000): Promise<GeolocationResult> {
        if (!navigator.geolocation) {
            return {
                success: false,
                error: 'Geolocation is not supported by this browser',
            };
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        success: true,
                        location: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        },
                    });
                },
                (error) => {
                    let errorMessage = 'Failed to get location';

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location permission denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                    }

                    resolve({
                        success: false,
                        error: errorMessage,
                    });
                },
                {
                    enableHighAccuracy: true,
                    timeout,
                    maximumAge: 0,
                }
            );
        });
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param point1 First location
     * @param point2 Second location
     * @returns Distance in meters
     */
    calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (point1.latitude * Math.PI) / 180;
        const φ2 = (point2.latitude * Math.PI) / 180;
        const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
        const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Check if location is available
     */
    isAvailable(): boolean {
        return 'geolocation' in navigator;
    }

    /**
     * Request permission (browser will prompt)
     */
    async requestPermission(): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        const result = await this.getCurrentPosition();
        return result.success;
    }
}

const geolocationService = new GeolocationService();
export default geolocationService;
