import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";

import { dayjs } from "../lib/dayjs";
import { prisma } from "../lib/prisma";
import { getMailClinet } from "../lib/mail";


export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
    schema: {
      params: z.object({
        tripId: z.string().uuid()
      })
    }
  }, async (request, reply) => {
    const { tripId } = request.params;

    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId
      },
      include: {
        participants: {
          where: {
            is_owner: false
          }
        }
      }
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.is_confirmed) {
      return reply.redirect(`https://localhost:3000/trips/{$tripId}`);
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: { is_confirmed: true }
    });


    const mail = await getMailClinet();
    const formattedStartDate = dayjs(trip.starts_at).format("LL");
    const formattedEndDate = dayjs(trip.ends_at).format("LL");

    await Promise.all(
      trip.participants.map(async (participant) => {
      const confirmationLink = `http://localhost:3333/participant/${participant.id}/confirm`;

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
      })
    )

    return reply.redirect(`https://localhost:3000/trips/{$tripId}`);
  });
}