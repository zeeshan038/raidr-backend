import prisma from "../../prisma/client.js";
import { CreateAvatarSchema } from "../../schema/Admin/Store.js";


/**
 * @Description Create Avatar for store
 * @Route POST /api/admin/store/create-avatar
 * @Access Private (Admin Only)
 */
export const CreateAvatar = async (req, res) => {
    const paylaod = req.body

    const result = CreateAvatarSchema(paylaod);
    if (result.error) {
        return res.status(400).json({
            status: false,
            msg: result.error.message
        })
    }
    try {
       const newAvatar = await prisma.store.create({
           data: {
               name: paylaod.name,
               frontUrl: paylaod.frontUrl,
               backUrl: paylaod.backUrl,
               price: paylaod.price,
               isFeatured: paylaod.isFeatured,
               isNew: paylaod.isNew
           }
       })

       return res.status(200).json({
            status: true,
            msg: "Avatar created successfully",
            data: newAvatar
       })
    } catch (error) {
        res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}