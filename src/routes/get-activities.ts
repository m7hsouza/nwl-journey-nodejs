import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../errors/client-error";

export async function getActivities(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/trips/:tripId/activities',
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid()
        }),
      }
    },
    async (request) => {
      const { tripId } = request.params;

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          activities: true,
        }
      });

      if (!trip) {
        throw new ClientError("Trip not found");
      }

      const differenceInDaysBetweenTrpsStartAndEnd = dayjs(trip.ends_at).diff(dayjs(trip.starts_at), 'day');
      const activities = Array.from({ length: differenceInDaysBetweenTrpsStartAndEnd + 1 }).map((_, index) => {
        const date = dayjs(trip.starts_at).add(index, 'day').toDate();
        return {
          date,
          activities: trip.activities.filter((activity) => dayjs(activity.occurs_at).isSame(date, 'day'))
        };
      });


      return { activities };
    }
  );
}