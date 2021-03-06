import React from 'react';
import {Route} from 'react-router';
import {BrowserRouter, Link} from 'react-router-dom';
import {Container, Row, Col, Table, Form, Button} from "react-bootstrap";
import App from "..";
import Plot from "react-plotly.js";
import {api_url} from "../router.js";
import "./portfolio.css";
import {links} from "../router.js";

const sessionExpired = "Session expired. Please refresh the page.";

const queries = {
    "1 Day" : ["1d", "15m"],
    "Month" : ["1mo", "1d"],
    "Year" : ["1y", "5d"],
    "5 Year" : ["5y", "1mo"]
}

class Portfolio extends React.Component {
    constructor(props){
        super(props);

        this.state = {
            portfolio : [],
            loaded_stocks : [],
            clicked_stock : null,
            intervals : [[],[]],
            prices : [],
            defaultQuery : "1 Day",
        }

        this.requestPortfolio = this.requestPortfolio.bind(this);
        this.loadStocks = this.loadStocks.bind(this);
        this.tableClickHandler = this.tableClickHandler.bind(this);
        this.onUnwatchLoad = this.onUnwatchLoad.bind(this);
        this.makeQuery = this.makeQuery.bind(this);
        this.setDefaultQueryRequest = this.setDefaultQueryRequest.bind(this);
    }

    componentDidMount(){
        this.requestPortfolio();
    }
    
    setDefaultQueryRequest(request){
        this.setState({defaultQuery : request})
    }

    requestPortfolio(){
        let request = new XMLHttpRequest();

        request.open("GET", api_url + "account-summary/");
        
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "JWT "+ window.sessionStorage.getItem("token"));
        request.send();
        request.onload = function() {
            if(request.status === 200){
                let response = JSON.parse(request.response);
                this.setState({portfolio : response.portfolio});
                this.loadStocks(response.portfolio);
            }
            else if(request.status === 401){
                //this.props.history.push(links.login);
                alert(sessionExpired);
            }
            else{
                alert(request.status);
            }
        }.bind(this);
    }

    loadStocks(portfolio){
        let industry_defaults = JSON.parse(window.sessionStorage.getItem("industry_defaults"));
        if(portfolio){
            portfolio.map((p,index) => {
                this.requestStock(p.symbol);
                if(index === 0){
                    this.makeQuery([["1d"],"15m"], p.symbol);
                    const {symbol, Open, High, Low, date} = p;
                    var clicked_stock = {
                                ticker : symbol, 
                                open : Open,
                                high : High,
                                low : Low,
                                date : date
                            };
                    this.setState({clicked_stock : clicked_stock});
                }
            })
        }
    }

    requestStock(ticker){
        let request = new XMLHttpRequest();

        request.open("GET", api_url + "scrape-stock-data/" + ticker + "/1d/1d/");
        
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "JWT "+ window.sessionStorage.getItem("token"));
        request.send();
        
        request.onload = function() {
            
            
            if(request.status === 200){
                let response = JSON.parse(request.response);
                
                response.payload[0].ticker = response.ticker;
                
                this.setState({loaded_stocks : this.state.loaded_stocks.concat(response.payload)});
                
            }
            else if(request.status === 401){
                //this.props.history.push(links.login);
                alert(sessionExpired);
            }
            else{
                //alert("Bad: " + request.response);
                //this.setState({showSuccessAlert : true});
            }
        }.bind(this);
    }

    onUnwatchLoad(ticker){
        let loaded_stocks = this.state.loaded_stocks;

        for(var i = 0; i < loaded_stocks.length; i++){
            if(loaded_stocks[i].ticker === ticker){
                loaded_stocks.splice(i, 1);
                break;
            }
        }
        
        this.setState({loaded_stocks : loaded_stocks, clicked_stock : null});
    }

    tableClickHandler(stock, e) {
        e.preventDefault();
        const {ticker, Open, High, Low, date} = stock;
        var clicked_stock = {
                                ticker : ticker, 
                                open : Open,
                                high : High,
                                low : Low,
                                date : date
                            };
        this.setState({clicked_stock : clicked_stock});
        this.makeQuery(queries[this.state.defaultQuery], clicked_stock.ticker);
    }
    

    makeQuery(query, ticker){
        let request = new XMLHttpRequest();
        let args = ticker + "/" + query[0] + "/" + query[1] + "/";
        request.open("GET", api_url + "scrape-stock-data/" + args);
        
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "JWT "+ window.sessionStorage.getItem("token"));
        
        request.send();
        request.onload = function() {

            if(request.status === 200){
                let response = JSON.parse(request.response);
                let prices = []; 
                let intervals = [[],[]];
                for(let i = 0; i < response.payload.length; i++){
                    if(response.payload[i].High !== "NaN"){
                        prices.push(response.payload[i].High);
                        intervals[0].push(response.payload[i].date);
                        // parse the time string
                        let time = response.payload[i].time.split("-")[0];
                        intervals[1].push(time.substring(0, time.length - 3));
                    }
                    
                }
                this.setState({intervals : intervals, prices : prices});
            }
            else if(request.status === 401){
                //this.props.history.push(links.login);
                alert(sessionExpired);
            }
        }.bind(this);
    }


    render () {
        
        return (
            <Container className="explore-container" fluid>
                <Row className="explore-row" fluid>
                    <Col id="stock-table-column" className="col-lg-7 stock-table-column">
                        <StockTable stocks={this.state.loaded_stocks} 
                                clickHandler={this.tableClickHandler.bind(this)} 
                                user={this.props.user}
                        />
                    </Col>
                    <Col id="actions-column" className="stock-menu-container col-lg-5">
                        <PortfolioMenu stocks={this.state.loaded_stocks} 
                                    makeQuery={this.makeQuery} 
                                    prices={this.state.prices} 
                                    intervals={this.state.intervals} 
                                    onUnwatchLoad={this.onUnwatchLoad} 
                                    stock={this.state.clicked_stock}
                                    setDefaultQueryRequest={this.setDefaultQueryRequest}
                        />
                    </Col>
                </Row>
            </Container>
            
        )
    }
}


class StockTable extends React.Component {
    /**
     * Table displaying all stocks the
     * use queried.
     * @param {*} props 
     */
    constructor(props){
        super(props);

        this.state = {
            stocks : null,
            clicked_stock : null,
        }
        
        this.renderTableData = this.renderTableData.bind(this);
    }


    renderTableData() {
        //let loaded_stocks = JSON.parse(window.localStorage.getItem("loaded_stock"));

        if(this.props.stocks){
            
            return this.props.stocks.map((stock, index) => {
                const {ticker, Open, High, Low, date} = stock;
                
                return (
                <tr key={ticker} onClick={(e) => this.props.clickHandler(stock, e)}>
                        {/* Make onclick() a function a() that updates the ui with symbol as a
                        parameter. a will query for more information using symbol. */}
                        <td>{ticker}</td>
                        <td>{Open}</td>
                        <td>{High}</td>
                        <td>{Low}</td>
                        <td>{date}</td>
                    </tr>
                )
    
            })
        }
        return null;
        
    }

    render() {
        const tabledata = this.renderTableData();
        let user;
        if(this.props.user){
            user = this.props.user;
        }
        else{
            user = null;
        }
        return(
            <>
                <p>{user}'s Watch List</p>
                <Table id="stock-table" striped hover>
                    <thead id="table-head">
                        <th>Symbol</th>
                        <th>Open</th>
                        <th>High</th>
                        <th>Low</th>
                        <th>Date</th>
                    </thead>
                    <tbody>
                        {tabledata.length > 0 ? tabledata : <tr><td/><td/><td>Loading...</td><td/><td/></tr>}
                    </tbody>
                </Table>
            </>
        )
    }
}


class PortfolioMenu extends React.Component{
    constructor(props){
        super(props);

        this.state = {
            
        }

        
        this.onQueryChange = this.onQueryChange.bind(this);
    }


    onUnwatchClick(){
        let request = new XMLHttpRequest();
        request.open("DELETE", api_url + "watch/");
        
        if(this.props.stock === null){
            return;
        }

        const body = {
            "symbol": this.props.stock.ticker,
            //"quantity": this.state.quantity_selected
        }
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "JWT "+ window.sessionStorage.getItem("token"));
        request.send(JSON.stringify(body));

        request.onload = function() {
            if(request.status === 200){
                let response = JSON.parse(request.response);
                if(response.alert === "success"){
                    this.props.onUnwatchLoad(response.symbol);
                }
                else{
                    alert("Not watching that one");
                }
            }
            else if(request.status){
                //this.props.history.push(links.login);
                alert(sessionExpired);
            }
        }.bind(this);
    }


    onQueryChange(event){
        

        if(this.props.stock){
            let query = queries[event.target.value];
            this.props.makeQuery(query, this.props.stock.ticker);
            this.props.setDefaultQueryRequest(event.target.value);
        }
        
    }

    

    render(){
        const stock = this.props.stock;
        return(
            <Form>
                <Form.Row>
                    <Form.Group className="stock-menu-text offset-2" as={Col}>{stock ? stock.ticker : "Click a symbol"}</Form.Group>
                    <Form.Group as={Col}>{stock ? "High: " + stock.high : null}</Form.Group>
                </Form.Row>
                <Form.Row>
                        
                        <Form.Control className="offset-2 col-lg-6" as="select" onChange={this.onQueryChange} name="query">
                            <option>1 Day</option>
                            <option>Month</option>
                            <option>Year</option>
                            <option>5 Year</option>
                        </Form.Control>
                    </Form.Row>
                <Form.Row>
                    <StockPlot prices={this.props.prices} intervals={this.props.intervals}/>
          
                </Form.Row>
                <Form.Row id="watch-menu">
                    <Form.Group as={Col} className="offset-2 col-lg-6">
                        <Button variant="danger" id="un-watch-button" block onClick={this.onUnwatchClick.bind(this)}>Un-watch</Button>
                    </Form.Group>
                </Form.Row>
            </Form>
        )
    }
}


class StockPlot extends React.Component{
    constructor(props){
        super(props);
    }
    
    render(){
        if(this.props.intervals.length > 0){
            var intervals;
            if(this.props.intervals[0][0] === this.props.intervals[0][1]){
                intervals = this.props.intervals[1];
            }// By date or by time?
            else{
                intervals = this.props.intervals[0];
            }
        }
        
        return(
            <Plot className="stock-plot"
                data={[
                    {
                        x: intervals,
                        y: this.props.prices,
                        type: 'scatter',
                        mode: 'lines+markers',
                        marker: {color: 'blue'},
                    },]}
                    layout={ {width: 600, height: 400} }
                    config={{displayModeBar: false}}
            />
        )
    }

}


export default Portfolio;