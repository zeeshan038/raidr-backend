



/**
 * @Description Get My Active Compaings
 * @Route GET /merchant/dashboard/active-campaigns
 * @Access Private
 */
export const GetMyActiveCampaigns = async (req, res) => {
    const { id } = req.merchant;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    try {
        
        const compaings = await prisma.campaign.findMany({
            where: {
                merchantId: id,
                isActive: true
            },
            skip,
            take: limit
        })

        return res.status(200).json({
            status: true,
            msg: "Active campaigns fetched successfully",
            campaigns,
            pagination:{
                page,
                limit,
                totalPages: Math.ceil(campaigns.length / limit)
            }
        })

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        })
    }
}


/**
 * @Description Get My Active Compaings
 * @Route GET /merchant/dashboard/active-campaigns
 * @Access Private
 */