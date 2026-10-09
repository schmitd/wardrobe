"use client";
import { Component, type ReactNode } from "react";
export default class HomeSectionBoundary extends Component<{children:ReactNode; title:string; retryLabel:string; reloadOnRetry?:boolean}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() {return {failed:true};}
  render() {
    if(this.state.failed) return <section className="rack-panel space-y-3 p-5" aria-label={`${this.props.title} unavailable`}>
      <h2 className="text-base font-bold">{this.props.title}</h2>
      <p role="alert">Your {this.props.title.toLowerCase()} could not load. Please try again.</p>
      <button type="button" className="min-h-11 border border-current px-4 font-semibold" onClick={()=>this.props.reloadOnRetry ? window.location.reload() : this.setState({failed:false})}>{this.props.retryLabel}</button>
    </section>;
    return this.props.children;
  }
}
