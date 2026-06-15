//Schema 
import {PlanYourTripSchema} from "../schema/Trip.js"


/**
 * @Description Plan you trip
 * @Route POST /trip/plan
 * @Access Private
 */
export const PlanYourTrip = async(req,res)=>{
    const payload = req.body;
 
    const result = PlanYourTripSchema(payload)
       if (result.error) {
           return res.status(400).json({
               status: false,
               msg: result.error.message
           })
       }
    
    try {

        const createTrip = await prisma.trip.create({
            data: {
                destination: payload.destination,
                hotelLocation: payload.hotelLocation,
                tripDates: payload.tripDates,
                radiusKm: payload.radiusKm,
                travelWith: payload.travelWith,
                interestedVibes: payload.interestedVibes,
                imageUrls: payload.imageUrls,
                user: {
                    connect: {
                        id: req.user.uid
                    }
                }
            }
        })

        return res.status(201).json({
            status: true,
            msg: "Trip planned successfully",
            trip: createTrip
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }


}