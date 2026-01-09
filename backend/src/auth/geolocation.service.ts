import { Injectable } from '@nestjs/common';

export interface GeoLocation {
    latitude: number;
    longitude: number;
}

@Injectable()
export class GeolocationService {
    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @param point1 First GPS coordinate
     * @param point2 Second GPS coordinate
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

        return R * c; // Distance in meters
    }

    /**
     * Verify if a location is within a specified radius
     * @param userLocation User's current GPS location
     * @param targetLocation Target center location
     * @param radiusMeters Radius in meters
     * @returns Object with verification status and distance
     */
    verifyWithinRadius(
        userLocation: GeoLocation,
        targetLocation: GeoLocation,
        radiusMeters: number,
    ): { isWithin: boolean; distance: number } {
        const distance = this.calculateDistance(userLocation, targetLocation);
        return {
            isWithin: distance <= radiusMeters,
            distance: Math.round(distance),
        };
    }
}
