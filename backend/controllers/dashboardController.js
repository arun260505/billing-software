const dashboardModel = require("../models/dashboardModel");

exports.getSummary = (req, res) => {

    dashboardModel.getSummary((err, result) => {

        if (err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:result[0]
        });

    });

};

exports.getTodaysSales = (req,res)=>{

    dashboardModel.getTodaysSales((err,result)=>{

        if(err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:result
        });

    });

};

exports.getRecentOrders=(req,res)=>{

    dashboardModel.getRecentOrders((err,result)=>{

        if(err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:result
        });

    });

};

exports.getTopItems=(req,res)=>{

    dashboardModel.getTopItems((err,result)=>{

        if(err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:result
        });

    });

};

exports.getTableStatus=(req,res)=>{

    dashboardModel.getTableStatus((err,result)=>{

        if(err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:result
        });

    });

};
exports.getSalesChart = (req, res) => {

    const period = req.query.period || "today";

    dashboardModel.getSalesChart(period, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: result
        });

    });

};