const contributors = [
    { name: "Irpansyah", count: 400 },
    { name: "Abri", count: 57 },
    { name: "Teguh", count: 30 },
    { name: "Rian Hidayat", count: 20 }
];

module.exports = async (req, res) => {
    return res.status(200).json({
        success: true,
        data: contributors
    });
};
