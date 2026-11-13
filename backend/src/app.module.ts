import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Domain modules (Auth, Orgs, Farms, Gis, Crops, Livestock, Health, Aqua,
 * Inventory, Feed, Iot, Weather, Forecast, Labor, Equipment, Accounting,
 * Harvest, Contracts, Coop, Finance, Sync, Vendors, Bookings, Orders,
 * Payments, Teleconsult, Notifications, Reports) will be registered here
 * as they are implemented. See Project_spec.md §7 and §13.
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
