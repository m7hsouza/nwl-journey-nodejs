import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClinet } from "../lib/mail";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/trips/:tripId/invites',
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid()
        }),
        body: z.object({
          email: z.string().email(),
        })
      }
    },
    async (request) => {
      const { email } = request.body;
      const { tripId } = request.params;

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        throw new ClientError("Trip not found");
      }

      const participant = await prisma.participant.create({
        data: {
          email,
          trip_id: tripId,
        }
      });

      const mail = await getMailClinet();
      const formattedStartDate = dayjs(trip.starts_at).format("LL");
      const formattedEndDate = dayjs(trip.ends_at).format("LL");
      const confirmationLink = `${env.API_BASE_URL}/participant/${participant.id}/confirm`;

      const message = await mail.sendMail({
        from: {
          name: "Travel App",
          address: "suporte@plann.er"
        },
        to: participant.email,
        subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartDate}`,
        html: `
            <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
              <p>
                Você foi convidado(a) para participar de uma viagem para <strong>${trip.destination}</strong> entre <strong>${formattedStartDate}</strong> e <strong>${formattedEndDate}</strong>
              </p>
              <p></p>
              <p>
                Para confirmar sua presença na viagem, clique no link abaixo:
              </p>
              <p></p>
              <p>
                <a href="${confirmationLink}">Confirmar viagem</a>
              </p>
              <p></p>
              <p>
                Caso você não tenha solicitado essa viagem, por favor, ignore esse email.
              </p>
            </div>
          `.trim()
      });

      console.log(nodemailer.getTestMessageUrl(message));


      return { participantId: participant.id };
    }
  );
}